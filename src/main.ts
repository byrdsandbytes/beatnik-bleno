import 'reflect-metadata';
// Use require for CommonJS compatibility with bleno
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bleno = require('@abandonware/bleno');
import { container, injectable } from 'tsyringe';
import { WiFiManagerService } from './services/wifi-manager.service';
import {
  SsidCharacteristic,
  PasswordCharacteristic,
  ConnectCharacteristic,
  StatusCharacteristic,
} from './characteristics/base.characteristic';
import { CONFIG } from './config/app.config';
import { ScanNetworksCharacteristic } from './characteristics/scan-networks.characteristic';
import { NetworkListCharacteristic } from './characteristics/network-list.characteristic';

/**
 * Application Bootstrap Class
 * Similar to Angular's main.ts and AppModule pattern
 */
@injectable()
class BeatnikApplication {
  constructor() {}

  /**
   * Bootstrap the application
   */
  public async bootstrap(): Promise<void> {
    // Force Bleno to use the first available HCI device (hci0)
    // This is crucial for compatibility with different Raspberry Pi models
    if (process.platform === 'linux') {
      process.env.BLENO_HCI_DEVICE_ID = '0';
    }

    console.log('🥦 Starting Beatnik WiFi Provisioning Service...');
    console.log('\n💡 Press Ctrl+C to stop the service.\n');

    this.setupDependencyInjection();
    this.setupBleno();
    this.setupGracefulShutdown(); // Add this call
  }

  /**
   * Setup Bleno event handlers
   */
  private setupBleno(): void {
    console.log('🔧 Initializing Bleno...');

    if (!bleno) {
      console.error('🔴 Bleno object is not available. The library may have failed to load.');
      process.exit(1);
    }

    console.log('🔧 Setting up Bleno event listeners...');
    bleno.on('stateChange', (state: string) => {
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
        console.error('🔴 Bluetooth is not powered on. Stopping...');
        bleno.stopAdvertising();
        process.exit(1); // Exit if the adapter is not usable
      }
    });

    bleno.on('advertisingStart', (error?: Error) => {
      if (error) {
        console.error('🔴 Advertising failed to start:', error);
        return;
      }

      console.log(`\n🥦 Advertising as "${CONFIG.bluetooth.deviceName}"`);
      console.log(`   Service UUID: ${CONFIG.bluetooth.serviceUuid}`);
      console.log(`\n📋 Available characteristics:`);
      console.log(`   • SSID:     ${CONFIG.characteristics.ssidUuid}`);
      console.log(`   • Password: ${CONFIG.characteristics.passwordUuid}`);
      console.log(`   • Connect:  ${CONFIG.characteristics.connectUuid}`);
      console.log(`   • Status:   ${CONFIG.characteristics.statusUuid}`);
      console.log(`   • Scan:     ${CONFIG.characteristics.scanNetworksUuid}`);
      console.log(`   • Networks: ${CONFIG.characteristics.networkListUuid}`);
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
    });

    // Handle client connections
    bleno.on('accept', (clientAddress: string) => {
      console.log(`\n🔗 Client connected: ${clientAddress}`);
    });

    // Handle client disconnections
    bleno.on('disconnect', (clientAddress: string) => {
      console.log(`\n🔌 Client disconnected: ${clientAddress}`);
    });
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
    const cleanup = () => {
      console.log('\n gracefully shutting down...');
      try {
        bleno.stopAdvertising(() => {
          console.log('✅ Advertising stopped.');
          // Disconnect any connected clients
          // (bleno handles this partially, but explicit cleanup is good)
          process.exit(0);
        });
      } catch (e) {
        console.error('🔴 Error during cleanup:', e);
        process.exit(1);
      }
    };

    // Listen for Ctrl+C
    process.on('SIGINT', cleanup);
    // Listen for kill commands
    process.on('SIGTERM', cleanup);
  }

  /**
   * Setup dependency injection
   */
  private setupDependencyInjection(): void {
    container.registerSingleton('WiFiManagerService', WiFiManagerService);
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
}

/**
 * Bootstrap the application
 * Similar to Angular's platformBrowserDynamic().bootstrapModule(AppModule)
 */
async function bootstrap(): Promise<void> {
  try {
    const app = container.resolve(BeatnikApplication);
    await app.bootstrap();
  } catch (error) {
    console.error('🔴 Unhandled error during bootstrap:', error);
    process.exit(1);
  }
}

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally exit or log
});

// Start the application
bootstrap();
