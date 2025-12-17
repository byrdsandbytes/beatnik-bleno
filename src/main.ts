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
    this.setupWiFiEventHandlers(); // Setup WiFi event listeners

    // Indicate ready state (LED Off)
    setTimeout(() => {
        this.gpioService.off();
    }, 2000); // Wait a bit to show the startup Amber color

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
      this.gpioService.setColor(0, 0, 1); // Constant Blue
    });

    // Handle client disconnections
    bleno.on('disconnect', (clientAddress: string) => {
      console.log(`\n🔌 Client disconnected: ${clientAddress}`);
      // If still advertising, go back to pulsing blue
      this.gpioService.pulse([0, 0, 1]); 
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

    // Short Press: Show Connection State
    this.gpioService.on('button_click', () => {
      console.log('🔘 Button Click! Showing connection state...');
      const status = wifiManager.getStatus();
      
      if (status.connected) {
          this.gpioService.setColor(0, 1, 0); // Green
      } else {
          this.gpioService.setColor(1, 0, 0); // Red
      }

      // Turn off after 3 seconds
      setTimeout(() => {
          this.gpioService.off();
      }, 3000);
    });

    // Long Press: Start BLE Provisioning
    this.gpioService.on('button_long_press', () => {
      console.log('🎉 Button Long Press! Starting WiFi Provisioning Service...');
      
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
  }

  /**
   * Setup WiFi event handlers for LED feedback
   */
  private setupWiFiEventHandlers(): void {
      const wifiManager = container.resolve(WiFiManagerService);

      // Searching for networks = pulsing blue and amber
      wifiManager.on('scan-started', () => {
          console.log('🔍 WiFi Scan Started - LED: Pulsing Blue/Amber');
          // Pulse between Blue (0,0,1) and Amber (1, 0.5, 0)
          this.gpioService.pulse([0, 0, 1], [1, 0.5, 0], 0.5, 0.5);
      });

      // Connecting to network = pulsing green
      // We can detect this via status updates or add a specific event. 
      // Status update is generic, so let's check the message or add a listener to 'status-update'
      wifiManager.on('status-update', (status: any) => {
          if (status.message === 'Connecting...') {
              console.log('🔄 Connecting - LED: Pulsing Green');
              this.gpioService.pulse([0, 1, 0], [0, 0, 0], 0.5, 0.5);
          } else if (status.connected && status.message === 'Connected successfully') {
              console.log('✅ Connected - LED: Constant Green (10s)');
              this.gpioService.setColor(0, 1, 0);
              setTimeout(() => {
                  this.gpioService.off();
              }, 10000);
          } else if (!status.connected && status.message.startsWith('Connection failed')) {
              console.log('❌ Connection Failed - LED: Flash Red (5s)');
              this.gpioService.blink([1, 0, 0], 0.2, 0.2);
              setTimeout(() => {
                  this.gpioService.off();
              }, 5000);
          }
      });

      // When scan is done, if we are advertising, go back to pulsing blue
      wifiManager.on('networks-found', () => {
          console.log('📶 Scan complete.');
          // If a client is connected, stay blue. If advertising, pulse blue.
          // This logic is a bit tricky because we don't track client count easily here.
          // But usually scan happens when client is connected.
          // If client is connected, we should be Constant Blue.
          // Let's rely on the fact that 'accept' sets it to Constant Blue.
          // But scan changes it to Pulse Blue/Amber.
          // So we need to restore Constant Blue if client is connected.
          // Since we don't have easy access to client count here, we can assume if we are scanning, a client is likely connected.
          this.gpioService.setColor(0, 0, 1); // Restore to Constant Blue (Client Connected state)
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
