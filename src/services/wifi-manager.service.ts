import { injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { WiFiCredentials, WiFiStatus, Platform } from '@models/wifi.model';
import { CONFIG } from '@config/app.config';

/**
 * WiFi Manager Service
 * Handles WiFi connection operations in an Angular-like service pattern
 * 
 * @injectable - Marks this class as injectable for dependency injection
 */
@injectable()
export class WiFiManagerService extends EventEmitter {
  private currentStatus: WiFiStatus = {
    connected: false,
    ssid: null,
    ip: null,
    message: 'Not connected',
  };

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize the service (similar to Angular's ngOnInit)
   */
  private initializeService(): void {
    console.log('🔧 WiFiManagerService initialized');
  }

  /**
   * Connect to a WiFi network
   */
  public async connect(credentials: WiFiCredentials): Promise<void> {
    console.log(`\n🔄 Attempting to connect to "${credentials.ssid}"...`);

    try {
      this.updateStatus({
        connected: false,
        ssid: credentials.ssid,
        ip: null,
        message: 'Connecting...',
      });

      const platform = process.platform as Platform;

      if (platform === Platform.LINUX) {
        await this.connectLinux(credentials);
      } else if (platform === Platform.DARWIN) {
        await this.connectMacOS(credentials);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Wait for connection to establish
      await this.sleep(CONFIG.wifi.connectionTimeout);

      // Verify connection
      const connected = await this.verifyConnection(credentials.ssid);

      if (connected) {
        const ip = await this.getIPAddress();
        this.updateStatus({
          connected: true,
          ssid: credentials.ssid,
          ip,
          message: 'Connected successfully',
        });
        console.log(`✅ Connected to "${credentials.ssid}" (IP: ${ip})`);
      } else {
        throw new Error('Connection verification failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateStatus({
        connected: false,
        ssid: credentials.ssid,
        ip: null,
        message: `Connection failed: ${errorMessage}`,
      });
      throw error;
    }
  }

  /**
   * Connect to WiFi on Linux (Raspberry Pi)
   */
  private async connectLinux(credentials: WiFiCredentials): Promise<void> {
    // Try using nmcli first (if NetworkManager is available)
    try {
      await this.execCommand(
        `nmcli device wifi connect "${credentials.ssid}" password "${credentials.password}"`
      );
      return;
    } catch (nmcliError) {
      console.log('⚠️  NetworkManager not available, trying wpa_supplicant...');
    }

    // Fallback to wpa_supplicant
    try {
      const wpaConfig = this.generateWPAConfig(credentials);
      const configPath = '/tmp/wpa_supplicant_temp.conf';
      
      await fs.writeFile(configPath, wpaConfig);
      await this.execCommand(`sudo cp ${configPath} /etc/wpa_supplicant/wpa_supplicant.conf`);
      await this.execCommand(`sudo wpa_cli -i ${CONFIG.wifi.interface} reconfigure`);
      await this.execCommand(`sudo dhclient ${CONFIG.wifi.interface}`);
    } catch (error) {
      console.error('Error configuring wpa_supplicant:', error);
      throw error;
    }
  }

  /**
   * Generate WPA configuration
   */
  private generateWPAConfig(credentials: WiFiCredentials): string {
    return `
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
    ssid="${credentials.ssid}"
    psk="${credentials.password}"
    key_mgmt=WPA-PSK
}
`;
  }

  /**
   * Connect to WiFi on macOS (for development/testing)
   */
  private async connectMacOS(credentials: WiFiCredentials): Promise<void> {
    try {
      const command = `networksetup -setairportnetwork en0 "${credentials.ssid}" "${credentials.password}"`;
      await this.execCommand(command);
    } catch (error) {
      console.error('Error connecting on macOS:', error);
      throw error;
    }
  }

  /**
   * Verify that we're connected to the specified SSID
   */
  private async verifyConnection(ssid: string): Promise<boolean> {
    try {
      const platform = process.platform as Platform;
      let command: string;

      if (platform === Platform.LINUX) {
        command = `iwconfig ${CONFIG.wifi.interface} 2>/dev/null | grep ESSID`;
      } else if (platform === Platform.DARWIN) {
        command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I';
      } else {
        return false;
      }

      const output = await this.execCommand(command);
      return output.includes(ssid);
    } catch (error) {
      console.error('Error verifying connection:', error);
      return false;
    }
  }

  /**
   * Get the current IP address
   */
  private async getIPAddress(): Promise<string | null> {
    try {
      const platform = process.platform as Platform;
      let command: string;

      if (platform === Platform.LINUX) {
        command = `ip addr show ${CONFIG.wifi.interface} | grep 'inet ' | awk '{print $2}' | cut -d/ -f1`;
      } else if (platform === Platform.DARWIN) {
        command = 'ipconfig getifaddr en0';
      } else {
        return null;
      }

      const output = await this.execCommand(command);
      return output.trim() || null;
    } catch (error) {
      console.error('Error getting IP address:', error);
      return null;
    }
  }

  /**
   * Get current WiFi status
   */
  public getStatus(): WiFiStatus {
    return { ...this.currentStatus };
  }

  /**
   * Update status and emit event
   */
  private updateStatus(status: Partial<WiFiStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.emit('statusChange', this.currentStatus);
  }

  /**
   * Execute a shell command
   */
  private execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Scan for available networks (optional feature)
   */
  public async scanNetworks(): Promise<string> {
    try {
      const platform = process.platform as Platform;
      let command: string;

      if (platform === Platform.LINUX) {
        command = `sudo iwlist ${CONFIG.wifi.interface} scan | grep ESSID`;
      } else if (platform === Platform.DARWIN) {
        command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s';
      } else {
        throw new Error('Unsupported platform');
      }

      const output = await this.execCommand(command);
      console.log('📡 Available networks:', output);
      return output;
    } catch (error) {
      console.error('Error scanning networks:', error);
      throw error;
    }
  }
}
