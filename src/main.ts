import 'reflect-metadata';
// Use require for CommonJS compatibility with bleno
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bleno = require('@abandonware/bleno');
import { container } from 'tsyringe';
import { WiFiManagerService } from './services/wifi-manager.service';
import { GpioService } from './services/gpio.service';
import { StateService } from './services/state.service';
import { AppState, ProvisioningState, BleState, SystemMode } from './models/state.model';
import {
  SsidCharacteristic,
  PasswordCharacteristic,
  ConnectCharacteristic,
  StatusCharacteristic,
} from './characteristics/base.characteristic';
import { CONFIG, LED_CONFIG } from './config/app.config';
import { ScanNetworksCharacteristic } from './characteristics/scan-networks.characteristic';
import { NetworkListCharacteristic } from './characteristics/network-list.characteristic';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Application Bootstrap Class
 * Similar to Angular's main.ts and AppModule pattern
 */
class BeatnikApplication {
  private gpioService: GpioService;
  private stateService: StateService;
  private previousProvisioningState: ProvisioningState = ProvisioningState.IDLE;
  private provisioningTimer: NodeJS.Timeout | null = null;
  private readonly PROVISIONING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private isStopping = false;
  private pendingActionTimer: NodeJS.Timeout | null = null;
  private readonly PENDING_ACTION_TIMEOUT_MS = 30 * 1000; // 30 seconds

  constructor() {}

  /**
   * Helper to apply LED pattern from config
   */
  private applyLedPattern(patternKey: keyof typeof LED_CONFIG): void {
      const config = LED_CONFIG[patternKey];
      if (!config) return;

      this.gpioService.sendCommand(config);
  }

  /**
   * Start the provisioning inactivity timer
   */
  private startProvisioningTimer(): void {
    this.stopProvisioningTimer();
    console.log(`⏳ Starting provisioning timer (${this.PROVISIONING_TIMEOUT_MS / 1000 / 60}m)...`);
    this.provisioningTimer = setTimeout(() => {
      console.log('⏰ Provisioning timeout reached. Stopping Bluetooth...');
      this.stopBluetooth();
    }, this.PROVISIONING_TIMEOUT_MS);
  }

  /**
   * Stop the provisioning inactivity timer
   */
  private stopProvisioningTimer(): void {
    if (this.provisioningTimer) {
      clearTimeout(this.provisioningTimer);
      this.provisioningTimer = null;
    }
  }

  /**
   * Helper to stop Bluetooth advertising and disconnect
   */
  private stopBluetooth(): void {
    this.isStopping = true;
    bleno.stopAdvertising();
    bleno.disconnect(); // Force disconnect if any client is connected
    this.stopProvisioningTimer();
    console.log('🛑 Bluetooth stopped.');
    this.applyLedPattern('OFF');
  }

  /**
   * Bootstrap the application
   */
  public async bootstrap(): Promise<void> {
    console.log('🥦 Starting Beatnik WiFi Provisioning Service...\n');

    this.setupDependencyInjection();
    this.gpioService = container.resolve(GpioService); // Resolve the service
    this.stateService = container.resolve(StateService); // Resolve state service
    this.setupBlenoEventHandlers();
    this.setupGracefulShutdown();
    this.setupButtonHandler(); // Setup button event listener
    this.setupWiFiEventHandlers(); // Setup WiFi event listeners

    // Initial LED Pattern: Solid Amber then White
    // setTimeout(() => {
    //     this.applyLedPattern('INITIAL');
    // }, 2000); // Slight delay to ensure GPIO service is ready

    // Indicate ready state (LED Off)
    setTimeout(() => {
        this.applyLedPattern('OFF');
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
      if (!error) {
        this.stateService.updateBleState(BleState.ADVERTISING);
        this.startProvisioningTimer();
      }
    });

    // Handle advertising stop
    bleno.on('advertisingStop', () => {
      console.log('🛑 Advertising stopped');
      this.stopProvisioningTimer();
    });

    // Handle client connections
    bleno.on('accept', (clientAddress: string) => {
      console.log(`\n🔗 Client connected: ${clientAddress}`);
      this.stopProvisioningTimer();
      this.stateService.updateBleState(BleState.CONNECTED);
      
      // Only set to blue if we are not currently busy with WiFi operations
      const provState = this.stateService.state.provisioning;
      if (provState === ProvisioningState.IDLE || provState === ProvisioningState.PROVISIONED) {
         this.applyLedPattern('CLIENT_CONNECTED');
      }
    });

    // Handle client disconnections
    bleno.on('disconnect', (clientAddress: string) => {
      console.log(`\n🔌 Client disconnected: ${clientAddress}`);

      if (this.isStopping) {
          console.log('🛑 Ignoring disconnect event (stopping)...');
          return;
      }

      this.stateService.updateBleState(BleState.ADVERTISING); // Assume back to advertising
      this.startProvisioningTimer();
      // If still advertising, go back to pulsing blue
      this.applyLedPattern('ADVERTISING');
    });
  }

  /**
   * Handle Bluetooth state changes
   */
  private onStateChange(state: string): void {
    console.log(`ℹ️  Bluetooth adapter state: ${state}`);

    if (state === 'poweredOn') {
      console.log('✅ Bluetooth powered on. Waiting for button press to start advertising...');
      this.stateService.updateBleState(BleState.POWERED_ON);
    } else {
      console.log('⚠️  Bluetooth not ready, stopping advertising...');
      this.stateService.updateBleState(BleState.UNKNOWN);
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

    this.applyLedPattern('ADVERTISING');

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
    container.registerSingleton('StateService', StateService);
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

    // Short Press
    this.gpioService.on('button_click', async () => {
      const mode = this.stateService.state.systemMode;

      if (mode === SystemMode.PENDING_ACTION) {
        console.log('🔘 Short press in PENDING_ACTION. Proceeding to Restart.');
        this.clearPendingActionTimer();
        this.applyLedPattern('RESTARTING');
        
        setTimeout(async () => {
          try {
            await execPromise('sudo reboot');
          } catch (e) {
            console.error('Failed to trigger restart:', e);
          }
        }, 1000); // 1-second delay for the LED to blink

        return;
      }

      console.log('🔘 Button Click! Checking and showing connection state...');
      
      // Force a live check of the connection status
      await wifiManager.checkCurrentConnection();
      
      const status = wifiManager.getStatus();
      
      if (status.connected) {
          this.applyLedPattern('CHECK_SUCCESS');
      } else {
          this.applyLedPattern('CHECK_FAIL');
      }

      // Turn off after 3 seconds
      setTimeout(() => {
          this.applyLedPattern('OFF');
      }, 3000);
    });

    // Long Press
    this.gpioService.on('button_long_press', (duration: number) => {
      const mode = this.stateService.state.systemMode;

      if (duration >= 10 && mode === SystemMode.NORMAL) {
        console.log(`⏱️ Extremely Long Press (${duration}s)! Entering Pending Action mode for Restart/Reset...`);
        this.stateService.updateSystemMode(SystemMode.PENDING_ACTION);
        this.startPendingActionTimer();
        this.applyLedPattern('PENDING_ACTION');
        return;
      }

      if (mode === SystemMode.PENDING_ACTION) {
        if (duration >= 5) {
          console.log(`⏱️ Long press in PENDING_ACTION (${duration}s). Proceeding to Reset.`);
          this.clearPendingActionTimer();
          this.applyLedPattern('RESETTING');

          setTimeout(async () => {
            try {
              // Delete all NetworkManager connections of type wifi
              await execPromise("nmcli --terse --fields UUID,TYPE connection show | grep 802-11-wireless | cut -d: -f1 | xargs -r nmcli connection delete");
              console.log('✅ Wiped WiFi credentials');
              // enable snapcast server 
              await execPromise('sudo systemctl enable snapcastserver');
              console.log('✅ Enabled Snapcast server');
              await execPromise('sudo reboot');
            } catch (e) {
              console.error('Failed to wipe credentials or reboot:', e);
            }
          }, 1000); // 1-second delay for the LED to blink
        } else {
          console.log('⚠️ Long press in PENDING_ACTION but duration < 5s. Ignoring.');
        }
        return;
      }

      // Default behavior (normal mode, long press < 10)
      console.log('🎉 Button Long Press! Starting WiFi Provisioning Service...');
      
      this.isStopping = false;
      if (bleno.state === 'poweredOn') {
        bleno.startAdvertising(
          CONFIG.bluetooth.deviceName,
          [CONFIG.bluetooth.serviceUuid],
          (error: any) => {
            if (error) {
              console.error('🛑 Error starting advertising:', error);
            } else {
              console.log('✅ Advertising started successfully.');
            }
          }
        );
      } else {
        console.log('⚠️  Cannot start advertising: Bluetooth not powered on.');
      }
    });
  }

  private startPendingActionTimer(): void {
    this.clearPendingActionTimer();
    this.pendingActionTimer = setTimeout(() => {
      console.log('⏰ Pending action timed out. Returning to normal behavior.');
      this.stateService.updateSystemMode(SystemMode.NORMAL);
      this.applyLedPattern('OFF');
    }, this.PENDING_ACTION_TIMEOUT_MS);
  }

  private clearPendingActionTimer(): void {
    if (this.pendingActionTimer) {
      clearTimeout(this.pendingActionTimer);
      this.pendingActionTimer = null;
    }
  }

  /**
   * Setup WiFi event handlers for LED feedback
   */
  private setupWiFiEventHandlers(): void {
      this.stateService.on('stateChanged', (state: AppState) => {
          // Detect state transition
          if (state.provisioning === this.previousProvisioningState) {
              return;
          }
          
          this.previousProvisioningState = state.provisioning;

          switch (state.provisioning) {
              case ProvisioningState.SCANNING:
                  console.log('🔍 WiFi Scan Started - LED: Pulsing Blue/Amber');
                  this.applyLedPattern('SCANNING');
                  break;
              case ProvisioningState.CONNECTING_WIFI:
                  console.log('🔄 Connecting - LED: Pulsing Green');
                  this.applyLedPattern('CONNECTING');
                  break;
              case ProvisioningState.PROVISIONED:
                  console.log('✅ Connected - LED: Constant Green (10s)');
                  this.applyLedPattern('PROVISIONED');
                  setTimeout(() => {
                      this.stopBluetooth();
                  }, 10000);
                  break;
              case ProvisioningState.ERROR:
                   console.log('❌ Error - LED: Flash Red (5s)');
                   this.applyLedPattern('ERROR');
                   setTimeout(() => {
                       this.applyLedPattern('CLIENT_CONNECTED');
                   }, 5000);
                   break;
              case ProvisioningState.IDLE:
                 // Restore to Constant Blue (Client Connected state) if BLE connected
                 if (state.ble === BleState.CONNECTED) {
                     this.applyLedPattern('CLIENT_CONNECTED');
                 }
                 break;
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
