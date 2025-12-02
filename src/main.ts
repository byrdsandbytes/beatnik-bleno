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

/**
 * Application Bootstrap Class
 * Similar to Angular's main.ts and AppModule pattern
 */
class BeatnikApplication {
  private gpioService: GpioService;

  constructor() {}

  /**
   * Bootstrap the application
   */
  public async bootstrap(): Promise<void> {
    console.log('🥦 Starting Beatnik WiFi Provisioning Service...\n');

    this.setupDependencyInjection();
    this.gpioService = container.resolve(GpioService); // Resolve the service
    this.setupBlenoEventHandlers();
    this.setupGracefulShutdown();
    this.setupButtonHandler(); // Setup button event listener

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
      this.gpioService.setColor(0, 1, 0); // Solid green
    });

    // Handle client disconnections
    bleno.on('disconnect', (clientAddress: string) => {
      console.log(`\n🔌 Client disconnected: ${clientAddress}`);
      this.gpioService.pulse([0, 0, 1]); // Back to pulsing blue
    });
  }

  /**
   * Handle Bluetooth state changes
   */
  private onStateChange(state: string): void {
    console.log(`ℹ️  Bluetooth adapter state: ${state}`);

    if (state === 'poweredOn') {
      console.log('✅ Bluetooth powered on. Waiting for button press to start advertising...');
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

    this.gpioService.pulse([0, 0, 1]); // Pulse blue to indicate advertising

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

    // Register characteristics as singletons FOR THIS SESSION
    // Note: WiFiManagerService is resolved from the parent container to share state
    sessionContainer.registerSingleton('SsidCharacteristic', SsidCharacteristic);
    sessionContainer.registerSingleton('PasswordCharacteristic', PasswordCharacteristic);
    sessionContainer.registerSingleton('ConnectCharacteristic', ConnectCharacteristic);
    sessionContainer.registerSingleton('StatusCharacteristic', StatusCharacteristic);
    sessionContainer.registerSingleton('ScanNetworksCharacteristic', ScanNetworksCharacteristic);
    sessionContainer.registerSingleton('NetworkListCharacteristic', NetworkListCharacteristic);

    // Resolve instances from the session container using STRING TOKENS to match injection
    const ssidChar = sessionContainer.resolve<SsidCharacteristic>('SsidCharacteristic');
    const passwordChar = sessionContainer.resolve<PasswordCharacteristic>('PasswordCharacteristic');
    const connectChar = sessionContainer.resolve<ConnectCharacteristic>('ConnectCharacteristic');
    const statusChar = sessionContainer.resolve<StatusCharacteristic>('StatusCharacteristic');
    const scanNetworksChar = sessionContainer.resolve<ScanNetworksCharacteristic>('ScanNetworksCharacteristic');
    const networkListChar = sessionContainer.resolve<NetworkListCharacteristic>('NetworkListCharacteristic');

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

    // Short Press: Trigger WiFi Scan / Provisioning
    this.gpioService.on('button_click', () => {
      console.log('🎉 Button Click! Starting WiFi Provisioning Service...');
      
      if (bleno.state === 'poweredOn') {
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
        console.log('⚠️  Cannot start advertising: Bluetooth not powered on.');
      }
    });

    // Medium Hold (2-8s): Restart Device
    this.gpioService.on('button_restart', () => {
      console.log('🔄 Button Restart Triggered! Rebooting...');
      this.gpioService.pulse([1, 0.5, 0]); // Pulse Orange
      
      // Execute reboot
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { exec } = require('child_process');
      exec('sudo reboot', (error: any) => {
        if (error) {
            console.error('Failed to reboot:', error);
        }
      });
    });

    // Long Hold (>8s): Factory Reset
    this.gpioService.on('button_reset', async () => {
      console.log('⚠️ Button Reset Triggered! Clearing Config...');
      this.gpioService.blink([1, 0, 0], 0.1, 0.1); // Fast Red Blink
      
      try {
        await wifiManager.disconnect();
        console.log('✅ Config cleared. Rebooting in 3 seconds...');
        
        setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { exec } = require('child_process');
            exec('sudo reboot');
        }, 3000);
      } catch (error) {
        console.error('Failed to reset:', error);
      }
    });

    // Also, listen for when the scan is done to return to the idle state
    wifiManager.on('networks-found', () => {
      console.log('📶 Network scan complete. Returning to idle LED state.');
      // Check if a client is connected to decide the correct state
      // For simplicity, we'll just go back to pulsing blue.
      // A more advanced state machine could be used here.
      this.gpioService.pulse([0, 0, 1]);
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
