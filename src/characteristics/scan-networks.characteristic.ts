import { Characteristic, Descriptor } from '@abandonware/bleno';
import { inject, injectable } from 'tsyringe';
import { CONFIG } from '../config/app.config';
import { WiFiManagerService } from '../services/wifi-manager.service';

@injectable()
export class ScanNetworksCharacteristic extends Characteristic {
  constructor(
    @inject('WiFiManagerService') private wifiManager: WiFiManagerService,
  ) {
    super({
      uuid: CONFIG.characteristics.scanNetworksUuid,
      properties: ['write'],
      value: null,
      descriptors: [
        new Descriptor({
          uuid: '2901',
          value: 'Trigger WiFi Scan',
        }),
      ],
    });
  }

  async onWriteRequest(
    data: Buffer,
    offset: number,
    _withoutResponse: boolean,
    callback: (result: number) => void,
  ): Promise<void> {
    console.log('ScanNetworksCharacteristic: Write request received.');

    if (offset) {
      callback(this.RESULT_ATTR_NOT_LONG);
      return;
    }

    if (data.length !== 1 || data.readUInt8(0) !== 1) {
      console.error('ScanNetworksCharacteristic: Invalid data. Expected 0x01.');
      callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);
      return;
    }

    try {
      console.log('ScanNetworksCharacteristic: Initiating WiFi scan...');
      // This will run in the background. The result will be sent via notification
      // on the NetworkListCharacteristic.
      this.wifiManager.scanNetworks();
      callback(this.RESULT_SUCCESS);
    } catch (error) {
      console.error(
        'ScanNetworksCharacteristic: Failed to start scan.',
        error,
      );
      callback(this.RESULT_UNLIKELY_ERROR);
    }
  }
}
