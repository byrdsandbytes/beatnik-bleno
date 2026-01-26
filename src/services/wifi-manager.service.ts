import { injectable, inject } from 'tsyringe';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import { WiFiCredentials, WiFiStatus, Network, Platform } from '../models/wifi.model';
import { CONFIG } from '../config/app.config';
import { StateService } from './state.service';
import { ProvisioningState } from '../models/state.model';

/**
 * WiFi Manager Service
 * Handles WiFi connection operations in an Angular-like service pattern
 * 
 * @injectable - Marks this class as injectable for dependency injection
 */
@injectable()
export class WiFiManagerService extends EventEmitter {
  constructor(
    @inject(StateService) private stateService: StateService
  ) {
    super();
    this.initializeService();
  }

  /**
   * Initialize the service (similar to Angular's ngOnInit)
   */
  private async initializeService(): Promise<void> {
    console.log('🔧 WiFiManagerService initialized');
    const deviceId = await this.getDeviceId();
    const hostname = os.hostname();
    this.updateStatus({ deviceId, hostname });
    
    // Check if we are already connected
    await this.checkCurrentConnection();
  }

  /**
   * Check if we are already connected to a network
   */
  public async checkCurrentConnection(): Promise<void> {
    try {
      const ip = await this.getIPAddress();
      if (ip) {
        // We have an IP, so we are likely connected. Let's find the SSID.
        const ssid = await this.getCurrentSSID();
        
        if (ssid) {
             this.updateStatus({
                connected: true,
                ssid: ssid,
                ip: ip,
                message: 'Connected',
             });
             console.log(`✅ Already connected to "${ssid}" (IP: ${ip})`);
        }
      }
    } catch (error) {
      console.warn('Failed to check current connection status:', error);
    }
  }

  /**
   * Get the currently connected SSID
   */
  private async getCurrentSSID(): Promise<string | null> {
    try {
      const platform = process.platform as Platform;
      let command: string;

      if (platform === Platform.LINUX) {
        // iwgetid -r prints just the SSID
        command = `iwgetid -r`; 
      } else if (platform === Platform.DARWIN) {
        command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I | grep " SSID" | cut -d ":" -f 2';
      } else {
        return null;
      }

      const output = await this.execCommand(command);
      const ssid = output.trim();
      return ssid || null;
    } catch (error) {
        // Fallback for Linux if iwgetid fails or isn't installed
        if (process.platform === Platform.LINUX) {
            try {
                const output = await this.execCommand(`iwconfig ${CONFIG.wifi.interface} 2>/dev/null | grep ESSID`);
                // Output format: wlan0     IEEE 802.11  ESSID:"MyNetwork"
                const match = output.match(/ESSID:"([^"]+)"/);
                if (match && match[1]) {
                    return match[1];
                }
            } catch (e) { /* ignore */ }
        }
        return null;
    }
  }

  /**
   * Connect to a WiFi network
   */
  public async connect(credentials: WiFiCredentials): Promise<void> {
    console.log(`\n🔄 Attempting to connect to "${credentials.ssid}"...`);

    try {
      this.stateService.updateProvisioningState(ProvisioningState.CONNECTING_WIFI);
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
        this.stateService.updateProvisioningState(ProvisioningState.PROVISIONED);
        console.log(`✅ Connected to "${credentials.ssid}" (IP: ${ip}, Hostname: ${hostname})`);
      } else {
        throw new Error('Connection verification failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Connection attempt failed: ${errorMessage}`);
      this.updateStatus({
        connected: false,
        ssid: credentials.ssid,
        ip: null,
        hostname: null,
        message: `Connection failed: ${errorMessage}`,
      });
      this.stateService.updateProvisioningState(ProvisioningState.ERROR);
      this.stateService.setError(errorMessage);
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
        console.warn('Error disconnecting via nmcli:', e);
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
      // Use single quotes for the whole command and escape the arguments
      // This prevents shell expansion of special characters in the password (like $)
      const ssidArg = this.escapeShellArg(credentials.ssid);
      const passArg = this.escapeShellArg(credentials.password);
      
      // Delete any existing connection profile for this SSID to ensure a fresh start
      // This fixes "802-11-wireless-security.key-mgmt: property is missing" errors
      // caused by stale or corrupted connection profiles
      try {
          await this.execCommand(`nmcli connection delete id ${ssidArg}`);
      } catch (e) {
          // Ignore error if connection doesn't exist
      }

      await this.execCommand(
        `nmcli device wifi connect ${ssidArg} password ${passArg}`
      );
      return;
    } catch (nmcliError) {
      const errMsg = (nmcliError as Error).message;
      console.warn(`⚠️  NetworkManager connect failed: ${errMsg}`);

      // If the service is not running, try to start it
      if (errMsg.includes('NetworkManager is not running') || errMsg.includes('failed to connect to socket') || errMsg.includes('not found')) {
          console.log('🔄 Attempting to start NetworkManager service...');
          try {
              await this.execCommand('sudo systemctl start NetworkManager');
              // Wait a bit for it to start
              await this.sleep(5000);
              
              // Try connecting again
              console.log('🔄 Retrying connection with NetworkManager...');
              const ssidArg = this.escapeShellArg(credentials.ssid);
              const passArg = this.escapeShellArg(credentials.password);
              
              // Also try deleting here just in case
              try {
                  await this.execCommand(`nmcli connection delete id ${ssidArg}`);
              } catch (e) { /* ignore */ }

              await this.execCommand(
                `nmcli device wifi connect ${ssidArg} password ${passArg}`
              );
              return;
          } catch (retryError) {
              console.error(`⚠️  NetworkManager retry failed: ${(retryError as Error).message}`);
              throw retryError;
          }
      }
      
      // If we get here, it failed and we are not falling back
      throw nmcliError;
    }
  }


  /**
   * Helper to escape shell arguments
   */
  private escapeShellArg(arg: string): string {
    // Replace ' with '"'"' to be safe inside single quotes
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
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
      const isConnected = output.includes(ssid);

      if (!isConnected) {
          console.warn(`Connection verification failed. Expected SSID "${ssid}" not found in output.`);
          console.warn(`Output was: ${output.trim()}`);
          
          if (platform === Platform.LINUX) {
              try {
                  const wpaStatus = await this.execCommand(`wpa_cli -i ${CONFIG.wifi.interface} status`);
                  console.warn(`wpa_cli status: ${wpaStatus}`);
              } catch (e) { /* ignore */ }
          }
      }

      return isConnected;
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
   * Get the device ID (MAC address)
   */
  private async getDeviceId(): Promise<string | null> {
    try {
      const platform = process.platform as Platform;
      
      if (platform === Platform.LINUX) {
        // Try to read MAC address from sysfs
        try {
          const mac = await fs.readFile(`/sys/class/net/${CONFIG.wifi.interface}/address`, 'utf8');
          return mac.trim();
        } catch (e) {
          // Fallback to ip link
          const output = await this.execCommand(`ip link show ${CONFIG.wifi.interface} | awk '/link\\/ether/ {print $2}'`);
          return output.trim() || null;
        }
      } else if (platform === Platform.DARWIN) {
        // macOS
        const output = await this.execCommand('networksetup -getmacaddress en0 | awk \'{print $3}\'');
        return output.trim() || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return null;
    }
  }

  /**
   * Get current WiFi status
   */
  public getStatus(): WiFiStatus {
    return this.stateService.state.wifiStatus;
  }

  /**
   * Update status and emit event
   */
  private updateStatus(status: Partial<WiFiStatus>): void {
    // Update central state
    this.stateService.updateWiFiStatus(status);
    
    // Emit event for backward compatibility
    this.emit('status-update', this.stateService.state.wifiStatus);
  }

  /**
   * Execute a shell command
   */
  private execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          if (stderr) {
            error.message += ` (stderr: ${stderr.trim()})`;
          }
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
    this.stateService.updateProvisioningState(ProvisioningState.SCANNING);
    this.emit('scan-started');
    // Use nmcli to scan for networks. -t for terse, -f for fields.
    // --rescan yes forces a new scan.
    const command = `nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list --rescan yes`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error scanning for networks: ${error.message}`);
        this.emit('error', new Error('Failed to scan for networks.'));
        this.stateService.updateProvisioningState(ProvisioningState.IDLE); // Go back to idle or error?
        return;
      }
      if (stderr) {
        // nmcli can print warnings to stderr, so we log but don't treat as a fatal error.
        console.warn(`Warning during network scan: ${stderr}`);
      }

      const networks = this.parseNmcliOutput(stdout);
      console.log(`Found ${networks.length} unique networks.`);

      if (networks.length === 0) {
        this.checkPossibleScanIssues();
      }

      this.stateService.updateProvisioningState(ProvisioningState.IDLE);
      this.emit('networks-found', networks);
    });
  }

  /**
   * Check for common issues if scan returns no results
   */
  private async checkPossibleScanIssues(): Promise<void> {
    try {
      // Check if WiFi country is set (common issue on Raspberry Pi)
      if (process.platform === Platform.LINUX) {
        try {
            const wpaConfig = await fs.readFile('/etc/wpa_supplicant/wpa_supplicant.conf', 'utf8');
            if (!wpaConfig.includes('country=')) {
                console.warn('⚠️  WARNING: No WiFi country code found in /etc/wpa_supplicant/wpa_supplicant.conf');
                console.warn('   WiFi scanning may be disabled until the country is set.');
                console.warn('   Run "sudo raspi-config" -> Localisation Options -> WLAN Country to set it.');
            }
        } catch (e) {
            // Ignore read error
        }
        
        // Check if rfkill is blocking
        try {
            const rfkill = await this.execCommand('rfkill list wifi');
            if (rfkill.includes('Soft blocked: yes') || rfkill.includes('Hard blocked: yes')) {
                console.warn('⚠️  WARNING: WiFi is blocked by rfkill.');
                console.warn('   Run "sudo rfkill unblock wifi" to fix.');
            }
        } catch (e) {
            // Ignore
        }
      }
    } catch (error) {
        console.error('Error checking scan issues:', error);
    }
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
