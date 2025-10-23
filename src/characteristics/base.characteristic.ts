// Use require for CommonJS compatibility with bleno
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bleno = require('@abandonware/bleno');
import { injectable, inject } from 'tsyringe';
import { WiFiManagerService } from '../services/wifi-manager.service';
import { CONFIG } from '../config/app.config';

/**
 * Base Characteristic Class
 * Provides common functionality for all characteristics
 */
export abstract class BaseCharacteristic extends bleno.Characteristic {
  constructor(uuid: string, properties: ("read" | "write" | "writeWithoutResponse" | "notify" | "indicate")[], description: string) {
    super({
      uuid,
      properties,
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901', // User Description
          value: description,
        }),
      ],
    });
  }

  /**
   * Helper to handle offset errors
   */
  protected handleOffset(offset: number, callback: (result: number) => void): boolean {
    if (offset) {
      callback(this.RESULT_ATTR_NOT_LONG);
      return true;
    }
    return false;
  }
}

/**
 * SSID Characteristic
 * Handles WiFi SSID input
 */
@injectable()
export class SsidCharacteristic extends BaseCharacteristic {
  private ssid: string = '';

  constructor() {
    super(CONFIG.characteristics.ssidUuid, ['write', 'writeWithoutResponse'], 'Wi-Fi SSID');
  }

  /**
   * Called when a client writes to this characteristic
   */
  onWriteRequest(
    data: Buffer,
    offset: number,
    _withoutResponse: boolean,
    callback: (result: number) => void
  ): void {
    if (this.handleOffset(offset, callback)) {
      return;
    }

    this.ssid = data.toString('utf8');
    console.log(`SSID set to: ${this.ssid}`);

    callback(this.RESULT_SUCCESS);
  }

  public getSSID(): string {
    return this.ssid;
  }
}

/**
 * Password Characteristic
 * Handles WiFi password input
 */
@injectable()
export class PasswordCharacteristic extends BaseCharacteristic {
  private password: string = '';

  constructor() {
    super(
      CONFIG.characteristics.passwordUuid,
      ['write', 'writeWithoutResponse'],
      'Wi-Fi Password'
    );
  }

  /**
   * Called when a client writes to this characteristic
   */
  onWriteRequest(
    data: Buffer,
    offset: number,
    _withoutResponse: boolean,
    callback: (result: number) => void
  ): void {
    if (this.handleOffset(offset, callback)) {
      return;
    }

    this.password = data.toString('utf8');
    console.log(`Password set (${this.password.length} characters)`);

    callback(this.RESULT_SUCCESS);
  }

  public getPassword(): string {
    return this.password;
  }
}

/**
 * Connect Characteristic
 * Triggers WiFi connection
 */
@injectable()
export class ConnectCharacteristic extends BaseCharacteristic {
  constructor(
    @inject('WiFiManagerService') private wifiManager: WiFiManagerService,
    @inject('SsidCharacteristic') private ssidChar: SsidCharacteristic,
    @inject('PasswordCharacteristic') private passwordChar: PasswordCharacteristic
  ) {
    super(
      CONFIG.characteristics.connectUuid,
      ['write', 'writeWithoutResponse'],
      'Connect to Wi-Fi (write 1 to connect)'
    );
  }

  /**
   * Called when a client writes to this characteristic
   */
  onWriteRequest(
    data: Buffer,
    offset: number,
    _withoutResponse: boolean,
    callback: (result: number) => void
  ): void {
    if (this.handleOffset(offset, callback)) {
      return;
    }

    const command = data.readUInt8(0);

    if (command === 1) {
      const ssid = this.ssidChar.getSSID();
      const password = this.passwordChar.getPassword();

      console.log('\nConnection request received!');
      console.log(`   SSID: ${ssid}`);
      console.log(`   Password: ${'*'.repeat(password.length)}`);

      if (!ssid) {
        console.error('Error: SSID not set');
        callback(this.RESULT_UNLIKELY_ERROR);
        return;
      }

      // Attempt to connect to WiFi
      this.wifiManager
        .connect({ ssid, password })
        .then(() => {
          console.log('Successfully connected to WiFi!');
          callback(this.RESULT_SUCCESS);
        })
        .catch((err: any) => {
          console.error('WiFi connection failed:', err.message);
          callback(this.RESULT_UNLIKELY_ERROR);
        });
    } else {
      callback(this.RESULT_SUCCESS);
    }
  }
}

/**
 * Status Characteristic
 * Provides connection status (read & notify)
 */
@injectable()
export class StatusCharacteristic extends BaseCharacteristic {
  private updateValueCallback: ((data: Buffer) => void) | null = null;

  constructor(@inject('WiFiManagerService') private wifiManager: WiFiManagerService) {
    super(CONFIG.characteristics.statusUuid, ['read', 'notify'], 'Connection Status');
    this.setupStatusListener();
  }

  /**
   * Setup listener for status changes
   */
  private setupStatusListener(): void {
    this.wifiManager.on('statusChange', (status) => {
      console.log('📊 WiFi status changed:', status);
      this.sendStatusUpdate(status);
    });
  }

  /**
   * Called when a client reads this characteristic
   */
  onReadRequest(offset: number, callback: (result: number, data?: Buffer) => void): void {
    const status = this.wifiManager.getStatus();
    const statusStr = JSON.stringify(status);
    const data = Buffer.from(statusStr, 'utf8');

    if (offset > data.length) {
      callback(this.RESULT_INVALID_OFFSET);
    } else {
      callback(this.RESULT_SUCCESS, data.slice(offset));
    }
  }

  /**
   * Called when a client subscribes to notifications
   */
  onSubscribe(_maxValueSize: number, updateValueCallback: (data: Buffer) => void): void {
    console.log('Client subscribed to status notifications');
    this.updateValueCallback = updateValueCallback;
  }

  /**
   * Called when a client unsubscribes from notifications
   */
  onUnsubscribe(): void {
    console.log('📱 Client unsubscribed from status notifications');
    this.updateValueCallback = null;
  }

  /**
   * Send status update to subscribed clients
   */
  private sendStatusUpdate(status: any): void {
    if (this.updateValueCallback) {
      const statusStr = JSON.stringify(status);
      const data = Buffer.from(statusStr, 'utf8');
      this.updateValueCallback(data);
    }
  }
}
