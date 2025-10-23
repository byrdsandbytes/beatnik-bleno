import 'reflect-metadata';
// Use require for CommonJS compatibility with bleno
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bleno = require('@abandonware/bleno');
import { container } from 'tsyringe';
import { WiFiManagerService } from './services/wifi-manager.service';
import {
  SsidCharacteristic,
  PasswordCharacteristic,
  ConnectCharacteristic,
  StatusCharacteristic,
} from './characteristics/base.characteristic';
import { CONFIG } from './config/app.config';

/**
 * Application Bootstrap Class
 * Similar to Angular's main.ts and AppModule pattern
 */
class BeatnikApplication {
  // private wifiManager!: WiFiManagerService;
  private ssidChar!: SsidCharacteristic;
  private passwordChar!: PasswordCharacteristic;
  private connectChar!: ConnectCharacteristic;
  private statusChar!: StatusCharacteristic;

  constructor() {
    this.setupDependencyInjection();
    this.initializeServices();
  }

  /**
   * Setup Dependency Injection Container
   * Similar to Angular's providers array
   */
  private setupDependencyInjection(): void {
    // Register services
    container.registerSingleton('WiFiManagerService', WiFiManagerService);
    
    // Register characteristics
    container.register('SsidCharacteristic', { useClass: SsidCharacteristic });
    container.register('PasswordCharacteristic', { useClass: PasswordCharacteristic });
    container.register('ConnectCharacteristic', { useClass: ConnectCharacteristic });
    container.register('StatusCharacteristic', { useClass: StatusCharacteristic });
  }

  /**
   * Initialize services and resolve dependencies
   */
  private initializeServices(): void {
  // this.wifiManager = container.resolve(WiFiManagerService);
    this.ssidChar = container.resolve(SsidCharacteristic);
    this.passwordChar = container.resolve(PasswordCharacteristic);
    this.connectChar = container.resolve(ConnectCharacteristic);
    this.statusChar = container.resolve(StatusCharacteristic);
  }

  /**
   * Bootstrap the application
   */
  public async bootstrap(): Promise<void> {
  console.log('🥦 Starting Beatnik WiFi Provisioning Service...\n');

    this.setupBlenoEventHandlers();
    this.setupGracefulShutdown();

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
    });

    // Handle client disconnections
    bleno.on('disconnect', (clientAddress: string) => {
      console.log(`\n🔌 Client disconnected: ${clientAddress}`);
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

    console.log(`\n🥦 Advertising as "${CONFIG.bluetooth.deviceName}"`);
    console.log(`   Service UUID: ${CONFIG.bluetooth.serviceUuid}`);
    console.log('\n📋 Available characteristics:');
    console.log(`   • SSID:     ${CONFIG.characteristics.ssidUuid}`);
    console.log(`   • Password: ${CONFIG.characteristics.passwordUuid}`);
    console.log(`   • Connect:  ${CONFIG.characteristics.connectUuid}`);
    console.log(`   • Status:   ${CONFIG.characteristics.statusUuid}`);
    console.log('\n💡 Waiting for client connection...\n');

    // Create and set services
    this.setupServices();
  }

  /**
   * Setup BLE services and characteristics
   */
  private setupServices(): void {
    const primaryService = new bleno.PrimaryService({
      uuid: CONFIG.bluetooth.serviceUuid,
      characteristics: [
        this.ssidChar as any,
        this.passwordChar as any,
        this.connectChar as any,
        this.statusChar as any,
      ],
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
    bleno.stopAdvertising();
    bleno.disconnect();
    process.exit(0);
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
