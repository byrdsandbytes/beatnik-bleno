// Use require for CommonJS compatibility with bleno
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bleno = require('@abandonware/bleno');
import { injectable, inject } from 'tsyringe';
import { WiFiManagerService } from '../services/wifi-manager.service';
import { CONFIG } from '../config/app.config';

// The BaseCharacteristic is no longer needed, as we will extend bleno.Characteristic directly.

/**
 * SSID Characteristic
 * Handles WiFi SSID input
 */
@injectable()
export class SsidCharacteristic extends bleno.Characteristic {
  private ssid: string = '';

  constructor() {
    super({
      uuid: CONFIG.characteristics.ssidUuid,
      properties: ['write', 'writeWithoutResponse'],
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901',
          value: 'Wi-Fi SSID',
        }),
      ],
      onWriteRequest: (data: Buffer, offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
        if (offset) {
          callback(this.RESULT_ATTR_NOT_LONG);
          return;
        }
        this.ssid = data.toString('utf8');
        console.log(`SSID set to: ${this.ssid}`);
        callback(this.RESULT_SUCCESS);
      },
    });
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
export class PasswordCharacteristic extends bleno.Characteristic {
  private password: string = '';

  constructor() {
    super({
      uuid: CONFIG.characteristics.passwordUuid,
      properties: ['write', 'writeWithoutResponse'],
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901',
          value: 'Wi-Fi Password',
        }),
      ],
      onWriteRequest: (data: Buffer, offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
        if (offset) {
          callback(this.RESULT_ATTR_NOT_LONG);
          return;
        }
        this.password = data.toString('utf8');
        console.log(`Password set (${this.password.length} characters)`);
        callback(this.RESULT_SUCCESS);
      },
    });
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
export class ConnectCharacteristic extends bleno.Characteristic {
  constructor(
    @inject('WiFiManagerService') private wifiManager: WiFiManagerService,
    @inject('SsidCharacteristic') private ssidChar: SsidCharacteristic,
    @inject('PasswordCharacteristic') private passwordChar: PasswordCharacteristic
  ) {
    super({
      uuid: CONFIG.characteristics.connectUuid,
      properties: ['write', 'writeWithoutResponse'],
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901',
          value: 'Connect to Wi-Fi (write 1 to connect)',
        }),
      ],
      onWriteRequest: (data: Buffer, offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
        if (offset) {
          callback(this.RESULT_ATTR_NOT_LONG);
          return;
        }

        const command = data.readUInt8(0);
        if (command !== 1) {
          callback(this.RESULT_SUCCESS);
          return;
        }

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
      },
    });
  }
}

/**
 * Status Characteristic
 * Provides connection status (read & notify)
 */
@injectable()
export class StatusCharacteristic extends bleno.Characteristic {
  private updateValueCallback: ((data: Buffer) => void) | null = null;

  constructor(@inject('WiFiManagerService') private wifiManager: WiFiManagerService) {
    super({
      uuid: CONFIG.characteristics.statusUuid,
      properties: ['read', 'notify'],
      descriptors: [
        new bleno.Descriptor({
          uuid: '2901',
          value: 'Connection Status',
        }),
      ],
      onReadRequest: (offset: number, callback: (result: number, data?: Buffer) => void) => {
        const status = this.wifiManager.getStatus();
        const statusStr = JSON.stringify(status);
        const data = Buffer.from(statusStr, 'utf8');

        if (offset > data.length) {
          callback(this.RESULT_INVALID_OFFSET);
        } else {
          callback(this.RESULT_SUCCESS, data.slice(offset));
        }
      },
      onSubscribe: (_maxValueSize: number, updateValueCallback: (data: Buffer) => void) => {
        console.log('Client subscribed to status notifications');
        this.updateValueCallback = updateValueCallback;
      },
      onUnsubscribe: () => {
        console.log('📱 Client unsubscribed from status notifications');
        this.updateValueCallback = null;
      },
    });

    this.setupStatusListener();
  }

  private setupStatusListener(): void {
    this.wifiManager.on('status-update', (status) => {
      console.log('📊 WiFi status changed:', status);
      if (this.updateValueCallback) {
        const statusStr = JSON.stringify(status);
        const data = Buffer.from(statusStr, 'utf8');
        this.updateValueCallback(data);
      }
    });
  }
}