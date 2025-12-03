import { injectable } from 'tsyringe';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import { WiFiCredentials, WiFiStatus, Network, Platform } from '../models/wifi.model';
import { CONFIG } from '../config/app.config';

/**
 * WiFi Manager Service
 * Handles WiFi connection operations in an Angular-like service pattern
 * 
 * @injectable - Marks this class as injectable for dependency injection
 */
@injectable()
export class WiFiManagerService extends EventEmitter {
  private status: WiFiStatus = {
    connected: false,
    ssid: null,
    ip: null,
    hostname: null,
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
        hostname: null,
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
        const hostname = os.hostname();
        this.updateStatus({
          connected: true,
          ssid: credentials.ssid,
          ip,
          hostname,
          message: 'Connected successfully',
        });
        console.log(`✅ Connected to "${credentials.ssid}" (IP: ${ip}, Hostname: ${hostname})`);
      } else {
        throw new Error('Connection verification failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateStatus({
        connected: false,
        ssid: credentials.ssid,
        ip: null,
        hostname: null,
        message: `Connection failed: ${errorMessage}`,
      });
      throw error;
    }
  }

  /**
   * Disconnect and clear WiFi configuration
   */
  public async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting and clearing WiFi config...');
    const platform = process.platform as Platform;
    
    if (platform === Platform.LINUX) {
      // Try nmcli
      try {
        await this.execCommand(`nmcli device disconnect ${CONFIG.wifi.interface}`);
      } catch (e) {
        // Ignore error if nmcli fails
      }

      // Reset wpa_supplicant
      try {
        const emptyConfig = `
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=CH
`;
        const configPath = '/tmp/wpa_supplicant_reset.conf';
        await fs.writeFile(configPath, emptyConfig);
        await this.execCommand(`sudo cp ${configPath} /etc/wpa_supplicant/wpa_supplicant.conf`);
        await this.execCommand(`sudo wpa_cli -i ${CONFIG.wifi.interface} reconfigure`);
      } catch (e) {
        console.error('Error resetting wpa_supplicant:', e);
      }
    } else if (platform === Platform.DARWIN) {
        // macOS implementation (optional, mostly for dev)
        // networksetup -removepreferredwirelessnetwork en0 <ssid>
    }
    
    this.updateStatus({
      connected: false,
      ssid: null,
      ip: null,
      hostname: null,
      message: 'Disconnected',
    });
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
      
      // Try dhclient first, fallback to dhcpcd
      try {
        await this.execCommand(`sudo dhclient ${CONFIG.wifi.interface}`);
      } catch (dhclientError) {
        console.log('⚠️  dhclient failed or not found, trying dhcpcd...');
        await this.execCommand(`sudo dhcpcd ${CONFIG.wifi.interface}`);
      }
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
    return { ...this.status };
  }

  /**
   * Update status and emit event
   */
  private updateStatus(status: Partial<WiFiStatus>): void {
    this.status = { ...this.status, ...status };
    this.emit('status-update', this.status);
  }

  /**
   * Execute a shell command
   */
  private execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
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
  public scanNetworks(): void {
    console.log('Starting WiFi network scan...');
    // Use nmcli to scan for networks. -t for terse, -f for fields.
    // --rescan yes forces a new scan.
    const command = `nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list --rescan yes`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error scanning for networks: ${error.message}`);
        this.emit('error', new Error('Failed to scan for networks.'));
        return;
      }
      if (stderr) {
        // nmcli can print warnings to stderr, so we log but don't treat as a fatal error.
        console.warn(`Warning during network scan: ${stderr}`);
      }

      const networks = this.parseNmcliOutput(stdout);
      console.log(`Found ${networks.length} unique networks.`);
      this.emit('networks-found', networks);
    });
  }

  private parseNmcliOutput(output: string): Network[] {
    const lines = output.trim().split('\n');
    const networksMap = new Map<string, Network>();

    lines.forEach(line => {
      // Handle escaped colons in SSIDs, although unlikely with -t flag
      const parts = line.split(/(?<!\\):/);
      if (parts.length >= 3) {
        const ssid = parts[0].replace(/\\:/g, ':');
        const quality = parseInt(parts[1], 10);
        const security = parts.slice(2).join(':'); // Security can contain colons

        if (ssid && !networksMap.has(ssid)) {
          networksMap.set(ssid, {
            ssid,
            quality,
            security: security.trim() || 'None',
          });
        }
      }
    });

    return Array.from(networksMap.values());
  }
}
