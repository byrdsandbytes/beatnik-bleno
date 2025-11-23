import 'reflect-metadata';
// Use require for CommonJS compatibility with bleno
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bleno = require('@abandonware/bleno');
import { container } from 'tsyringe';
import { WiFiManagerService } from './services/wifi-manager.service';
import { GpioService } from './services/gpio.service';
import {
  SsidCharacteristic,
  PasswordCharacteristic,
  ConnectCharacteristic,
  StatusCharacteristic,
} from './characteristics/base.characteristic';
import { CONFIG } from './config/app.config';
import { ScanNetworksCharacteristic } from './characteristics/scan-networks.characteristic';
import { NetworkListCharacteristic } from './characteristics/network-list.characteristic';
import { WiFiStatus } from './models/wifi.model';

/**
 * Application Bootstrap Class
 * Similar to Angular's main.ts and AppModule pattern
 */
class BeatnikApplication {
  private gpioService: GpioService;
  private isClientConnected = false;

  constructor() {}

  /**
   * Bootstrap the application
   */
  public async bootstrap(): Promise<void> {
    console.log('🥦 Starting Beatnik WiFi Provisioning Service...\n');

    this.setupDependencyInjection();
    this.gpioService = container.resolve(GpioService); // Resolve the service
    this.gpioService.setColor(1, 0.5, 0); // Solid Amber: Initializing/Idle

    this.setupBlenoEventHandlers();
    this.setupGracefulShutdown();
    this.setupButtonHandler(); // Setup button event listener
    this.setupWifiStatusHandler(); // Listen for WiFi connection results

    console.log('💡 Press Ctrl+C to stop the service.\n');
  }

  /**
   * Setup Bleno event handlers
   */
  private setupBlenoEventHandlers(): void {
    // Handle state changes
    bleno.on('stateChange', (state: string) => {
      this.onStateChange(state);
    });

    // Handle advertising start
    bleno.on('advertisingStart', (error: any) => {
      this.onAdvertisingStart(error);
    });

    // Handle client connections
    bleno.on('accept', (clientAddress: string) => {
      console.log(`\n🔗 Client connected: ${clientAddress}`);
      this.isClientConnected = true;
      this.gpioService.setColor(0, 0, 1); // Solid Blue: BLE connected
    });

    // Handle client disconnections
    bleno.on('disconnect', (clientAddress: string) => {
      console.log(`\n🔌 Client disconnected: ${clientAddress}`);
      this.isClientConnected = false;
      this.gpioService.pulse([0, 0, 1]); // Pulsing Blue: Waiting for connection
    });
  }

  /**
   * Handle Bluetooth state changes
   */
  private onStateChange(state: string): void {
    console.log(`ℹ️  Bluetooth adapter state: ${state}`);

    if (state === 'poweredOn') {
      bleno.startAdvertising(
        CONFIG.bluetooth.deviceName,
        [CONFIG.bluetooth.serviceUuid],
        (error: any) => {
          if (error) {
            console.error('🛑 Error starting advertising:', error);
          }
        }
      );
    } else {
      console.log('⚠️  Bluetooth not ready, stopping advertising...');
      bleno.stopAdvertising();
    }
  }

  /**
   * Handle advertising start event
   */
  private onAdvertisingStart(error: Error | null): void {
    if (error) {
      console.error('🛑 Error on advertising start:', error);
      return;
    }

    this.gpioService.pulse([0, 0, 1]); // Pulsing Blue: Waiting for connection

    console.log(`\n🥦 Advertising as "${CONFIG.bluetooth.deviceName}"`);
    console.log(`   Service UUID: ${CONFIG.bluetooth.serviceUuid}`);
    console.log('\n📋 Available characteristics:');
    console.log(`   • SSID:     ${CONFIG.characteristics.ssidUuid}`);
    console.log(`   • Password: ${CONFIG.characteristics.passwordUuid}`);
    console.log(`   • Connect:  ${CONFIG.characteristics.connectUuid}`);
    console.log(`   • Status:   ${CONFIG.characteristics.statusUuid}`);
    console.log('\n💡 Waiting for client connection...\n');

    // Create a new child container for this session to ensure fresh instances
    const sessionContainer = container.createChildContainer();

    // Register services and characteristics as singletons FOR THIS SESSION
    sessionContainer.registerSingleton('WiFiManagerService', WiFiManagerService);
    sessionContainer.registerSingleton('SsidCharacteristic', SsidCharacteristic);
    sessionContainer.registerSingleton('PasswordCharacteristic', PasswordCharacteristic);
    sessionContainer.registerSingleton('ConnectCharacteristic', ConnectCharacteristic);
    sessionContainer.registerSingleton('StatusCharacteristic', StatusCharacteristic);
    sessionContainer.registerSingleton('ScanNetworksCharacteristic', ScanNetworksCharacteristic);
    sessionContainer.registerSingleton('NetworkListCharacteristic', NetworkListCharacteristic);

    // Resolve instances from the session container
    const ssidChar = sessionContainer.resolve(SsidCharacteristic);
    const passwordChar = sessionContainer.resolve(PasswordCharacteristic);
    const connectChar = sessionContainer.resolve(ConnectCharacteristic);
    const statusChar = sessionContainer.resolve(StatusCharacteristic);
    const scanNetworksChar = sessionContainer.resolve(ScanNetworksCharacteristic);
    const networkListChar = sessionContainer.resolve(NetworkListCharacteristic);

    // Create and set services
    this.setupServices([ssidChar, passwordChar, connectChar, statusChar, scanNetworksChar, networkListChar]);
  }

  /**
   * Setup BLE services and characteristics
   */
  private setupServices(characteristics: any[]): void {
    const primaryService = new bleno.PrimaryService({
      uuid: CONFIG.bluetooth.serviceUuid,
      characteristics: characteristics,
    });

    bleno.setServices([primaryService], (error: any) => {
      if (error) {
        console.error('🛑 Error setting services:', error);
      } else {
        console.log('🥦 Services configured successfully.');
      }
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    process.on('SIGINT', () => {
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.shutdown();
    });
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    console.log('\n\n🛑 Shutting down...');
    this.gpioService.cleanup(); // Clean up the GPIO child process
    bleno.stopAdvertising();
    bleno.disconnect();
    process.exit(0);
  }

  /**
   * Setup dependency injection
   */
  private setupDependencyInjection(): void {
    container.registerSingleton('WiFiManagerService', WiFiManagerService);
    container.registerSingleton('GpioService', GpioService);
    container.register('SsidCharacteristic', { useClass: SsidCharacteristic });
    container.register('PasswordCharacteristic', {
      useClass: PasswordCharacteristic,
    });
    container.register('ConnectCharacteristic', {
      useClass: ConnectCharacteristic,
    });
    container.register('StatusCharacteristic', {
      useClass: StatusCharacteristic,
    });
    container.register('ScanNetworksCharacteristic', {
      useClass: ScanNetworksCharacteristic,
    });
    container.register('NetworkListCharacteristic', {
      useClass: NetworkListCharacteristic,
    });
  }

  /**
   * Setup handler for button press events
   */
  private setupButtonHandler(): void {
    const wifiManager = container.resolve(WiFiManagerService);

    this.gpioService.on('button_pressed', () => {
      console.log('🎉 Button press received! Triggering WiFi scan.');
      this.gpioService.blink([1, 1, 0]); // Blink yellow for scanning
      wifiManager.scanNetworks();
    });

    // When the scan is done, return to the correct idle state
    wifiManager.on('networks-found', () => {
      console.log('📶 Network scan complete. Returning to idle LED state.');
      if (this.isClientConnected) {
        this.gpioService.setColor(0, 0, 1); // Solid Blue
      } else {
        this.gpioService.pulse([0, 0, 1]); // Pulsing Blue
      }
    });
  }

  /**
   * Setup handler for WiFi status events to control LED
   */
  private setupWifiStatusHandler(): void {
    const wifiManager = container.resolve(WiFiManagerService);

    wifiManager.on('status-update', (status: WiFiStatus) => {
      if (status.connected) {
        this.gpioService.setColor(0, 1, 0); // Solid Green: WiFi connected
      } else if (status.message.toLowerCase().includes('fail') || status.message.toLowerCase().includes('timed out')) {
        this.gpioService.blink([1, 0, 0]); // Blinking Red: Error
      }
    });
  }
}

/**
 * Bootstrap the application
 * Similar to Angular's platformBrowserDynamic().bootstrapModule(AppModule)
 */
async function bootstrap(): Promise<void> {
  try {
    const app = new BeatnikApplication();
    await app.bootstrap();
  } catch (error) {
    console.error('❌ Failed to bootstrap application:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
