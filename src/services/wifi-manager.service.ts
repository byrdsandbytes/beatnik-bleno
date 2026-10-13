import { injectable, inject } from 'tsyringe';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import os from 'os';
import { WiFiCredentials, WiFiStatus, Platform } from '../models/wifi.model';
import { CONFIG } from '../config/app.config';
import { StateService } from './state.service';
import { WiFiScanner } from './wifi-scanner';
import { ProvisioningState } from '../models/state.model';
import { run, sleep } from '../utils/shell.util';
import { splitTerse } from '../utils/nmcli.util';

const MAC_INTERFACE = 'en0';
const NETWORK_MANAGER_DOWN = ['NetworkManager is not running', 'failed to connect to socket', 'not found'];

/**
 * WiFi Manager Service
 * Connection, status and scan orchestration.
 *
 * Events: 'status-update' (WiFiStatus), 'scan-started', 'networks-found' (Network[]), 'scan-failed' (Error)
 */
@injectable()
export class WiFiManagerService extends EventEmitter {
  private readonly scanner = new WiFiScanner(CONFIG.wifi.interface);
  private scanInFlight: Promise<void> | null = null;

  constructor(
    @inject(StateService) private stateService: StateService
  ) {
    super();
    this.initializeService();
  }

  private get platform(): Platform {
    return process.platform as Platform;
  }

  private async initializeService(): Promise<void> {
    console.log('🔧 WiFiManagerService initialized');
    const deviceId = await this.getDeviceId();
    this.updateStatus({ deviceId, hostname: os.hostname() });
    await this.checkCurrentConnection();
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  public getStatus(): WiFiStatus {
    return this.stateService.state.wifiStatus;
  }

  private updateStatus(status: Partial<WiFiStatus>): void {
    this.stateService.updateWiFiStatus(status);
    this.emit('status-update', this.stateService.state.wifiStatus);
  }

  /**
   * Check if we are already connected to a network
   */
  public async checkCurrentConnection(): Promise<void> {
    try {
      const ip = await this.getIPAddress();
      if (!ip) return;

      const ssid = await this.getCurrentSSID();
      if (!ssid) return;

      this.updateStatus({ connected: true, ssid, ip, message: 'Connected' });
      console.log(`✅ Already connected to "${ssid}" (IP: ${ip})`);
    } catch (error) {
      console.warn('Failed to check current connection status:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Connect / disconnect
  // ---------------------------------------------------------------------------

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

      if (this.platform === Platform.LINUX) {
        await this.connectLinux(credentials);
      } else if (this.platform === Platform.DARWIN) {
        await this.connectMacOS(credentials);
      } else {
        throw new Error(`Unsupported platform: ${this.platform}`);
      }

      await sleep(CONFIG.wifi.connectionTimeout);

      if (!(await this.verifyConnection(credentials.ssid))) {
        throw new Error('Connection verification failed');
      }

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

    if (this.platform === Platform.LINUX) {
      try {
        await run('nmcli', ['device', 'disconnect', CONFIG.wifi.interface]);
      } catch (e) {
        console.warn('Error disconnecting via nmcli:', e);
      }
    }

    this.updateStatus({
      connected: false,
      ssid: null,
      ip: null,
      hostname: null,
      message: 'Disconnected',
    });
  }

  private async connectLinux(credentials: WiFiCredentials): Promise<void> {
    try {
      await this.nmcliConnect(credentials);
    } catch (error) {
      const message = (error as Error).message;
      console.warn(`⚠️  NetworkManager connect failed: ${message}`);

      if (!NETWORK_MANAGER_DOWN.some((pattern) => message.includes(pattern))) {
        throw error;
      }

      console.log('🔄 Attempting to start NetworkManager service...');
      await run('sudo', ['systemctl', 'start', 'NetworkManager']);
      await sleep(5000);

      console.log('🔄 Retrying connection with NetworkManager...');
      await this.nmcliConnect(credentials);
    }
  }

  private async nmcliConnect({ ssid, password }: WiFiCredentials): Promise<void> {
    // A stale profile for this SSID causes "802-11-wireless-security.key-mgmt: property is missing".
    await run('nmcli', ['connection', 'delete', 'id', ssid]).catch(() => undefined);

    await run(
      'nmcli',
      ['device', 'wifi', 'connect', ssid, 'password', password, 'ifname', CONFIG.wifi.interface],
      { secrets: [password] },
    );
  }

  private async connectMacOS({ ssid, password }: WiFiCredentials): Promise<void> {
    try {
      await run('networksetup', ['-setairportnetwork', MAC_INTERFACE, ssid, password], {
        secrets: [password],
      });
    } catch (error) {
      console.error('Error connecting on macOS:', error);
      throw error;
    }
  }

  private async verifyConnection(ssid: string): Promise<boolean> {
    const current = await this.getCurrentSSID();
    const isConnected = current === ssid;

    if (!isConnected) {
      console.warn(`Connection verification failed. Expected SSID "${ssid}", got "${current ?? ''}".`);

      if (this.platform === Platform.LINUX) {
        try {
          const wpaStatus = await run('wpa_cli', ['-i', CONFIG.wifi.interface, 'status']);
          console.warn(`wpa_cli status: ${wpaStatus}`);
        } catch { /* wpa_cli is optional diagnostics */ }
      }
    }

    return isConnected;
  }

  // ---------------------------------------------------------------------------
  // Scan
  // ---------------------------------------------------------------------------

  /**
   * Scan for available networks. Concurrent calls share one scan.
   * Results are delivered via 'networks-found'; failures via 'scan-failed'.
   */
  public scanNetworks(): Promise<void> {
    if (this.scanInFlight) {
      console.log('WiFi scan already in progress.');
      return this.scanInFlight;
    }

    this.scanInFlight = this.runScan().finally(() => {
      this.scanInFlight = null;
    });
    return this.scanInFlight;
  }

  private async runScan(): Promise<void> {
    console.log('Starting WiFi network scan...');
    this.stateService.updateProvisioningState(ProvisioningState.SCANNING);
    this.emit('scan-started');

    try {
      if (this.platform !== Platform.LINUX) {
        throw new Error(`WiFi scanning is not supported on ${this.platform}`);
      }

      const networks = await this.scanner.scan();
      console.log(`Found ${networks.length} networks.`);

      this.resetScanningState();
      this.emit('networks-found', networks);

      if (networks.length === 0) {
        await this.logPossibleScanIssues();
      }
    } catch (error) {
      console.error(`Error scanning for networks: ${(error as Error).message}`);
      this.resetScanningState();
      this.emit('scan-failed', error);
    }
  }

  // Don't clobber CONNECTING_WIFI / PROVISIONED if they changed mid-scan.
  private resetScanningState(): void {
    if (this.stateService.state.provisioning === ProvisioningState.SCANNING) {
      this.stateService.updateProvisioningState(ProvisioningState.IDLE);
    }
  }

  private async logPossibleScanIssues(): Promise<void> {
    try {
      const wpaConfig = await fs.readFile('/etc/wpa_supplicant/wpa_supplicant.conf', 'utf8');
      if (!wpaConfig.includes('country=')) {
        console.warn('⚠️  WARNING: No WiFi country code found in /etc/wpa_supplicant/wpa_supplicant.conf');
        console.warn('   WiFi scanning may be disabled until the country is set.');
        console.warn('   Run "sudo raspi-config" -> Localisation Options -> WLAN Country to set it.');
      }
    } catch { /* file is absent on NetworkManager-only systems */ }

    try {
      const rfkill = await run('rfkill', ['list', 'wifi']);
      if (rfkill.includes('Soft blocked: yes') || rfkill.includes('Hard blocked: yes')) {
        console.warn('⚠️  WARNING: WiFi is blocked by rfkill.');
        console.warn('   Run "sudo rfkill unblock wifi" to fix.');
      }
    } catch { /* rfkill not installed */ }
  }

  // ---------------------------------------------------------------------------
  // System queries
  // ---------------------------------------------------------------------------

  private async getCurrentSSID(): Promise<string | null> {
    try {
      if (this.platform === Platform.LINUX) {
        return await this.getCurrentSSIDLinux();
      }
      if (this.platform === Platform.DARWIN) {
        const output = await run('networksetup', ['-getairportnetwork', MAC_INTERFACE]);
        return output.match(/Current Wi-Fi Network:\s*(.+)/)?.[1].trim() || null;
      }
    } catch { /* not connected */ }
    return null;
  }

  private async getCurrentSSIDLinux(): Promise<string | null> {
    try {
      const output = await run('nmcli', [
        '-t', '-f', 'ACTIVE,SSID',
        'device', 'wifi', 'list',
        'ifname', CONFIG.wifi.interface,
        '--rescan', 'no',
      ]);
      for (const line of output.split('\n')) {
        const [active, ssid] = splitTerse(line);
        if (active === 'yes' && ssid) return ssid;
      }
    } catch { /* fall back to wireless-tools */ }

    try {
      const output = await run('iwgetid', [CONFIG.wifi.interface, '-r']);
      return output.trim() || null;
    } catch {
      return null;
    }
  }

  private async getIPAddress(): Promise<string | null> {
    try {
      if (this.platform === Platform.LINUX) {
        const output = await run('ip', ['-4', '-o', 'addr', 'show', 'dev', CONFIG.wifi.interface]);
        return output.match(/inet (\d+(?:\.\d+){3})/)?.[1] ?? null;
      }
      if (this.platform === Platform.DARWIN) {
        const output = await run('ipconfig', ['getifaddr', MAC_INTERFACE]);
        return output.trim() || null;
      }
    } catch (error) {
      console.error('Error getting IP address:', error);
    }
    return null;
  }

  /**
   * Get the device ID (MAC address)
   */
  private async getDeviceId(): Promise<string | null> {
    try {
      if (this.platform === Platform.LINUX) {
        try {
          const mac = await fs.readFile(`/sys/class/net/${CONFIG.wifi.interface}/address`, 'utf8');
          return mac.trim();
        } catch {
          const output = await run('ip', ['-o', 'link', 'show', 'dev', CONFIG.wifi.interface]);
          return output.match(/link\/ether\s+([0-9a-f:]{17})/i)?.[1] ?? null;
        }
      }
      if (this.platform === Platform.DARWIN) {
        const output = await run('networksetup', ['-getmacaddress', MAC_INTERFACE]);
        return output.match(/Ethernet Address:\s*([0-9a-f:]{17})/i)?.[1] ?? null;
      }
    } catch (error) {
      console.error('Error getting device ID:', error);
    }
    return null;
  }
}
