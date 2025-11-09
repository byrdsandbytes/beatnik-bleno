import { Characteristic, Descriptor } from '@abandonware/bleno';
import { inject, injectable } from 'tsyringe';
import { CONFIG } from '../config/app.config';
import { WiFiManagerService } from '../services/wifi-manager.service';
import { Network } from '../models/wifi.model';

@injectable()
export class NetworkListCharacteristic extends Characteristic {
  private updateValueCallback: ((data: Buffer) => void) | null = null;

  constructor(
    @inject('WiFiManagerService') private wifiManager: WiFiManagerService,
  ) {
    super({
      uuid: CONFIG.characteristics.networkListUuid,
      properties: ['notify'],
      descriptors: [
        new Descriptor({
          uuid: '2901',
          value: 'List of scanned WiFi networks',
        }),
      ],
    });

    this.wifiManager.on('networks-found', (networks: Network[]) => {
      this.sendNetworks(networks);
    });
  }

  onSubscribe(
    maxValueSize: number,
    updateValueCallback: (data: Buffer) => void,
  ): void {
    console.log(
      `NetworkListCharacteristic: Client subscribed. MaxValueSize: ${maxValueSize}`,
    );
    this.updateValueCallback = updateValueCallback;
  }

  onUnsubscribe(): void {
    console.log('NetworkListCharacteristic: Client unsubscribed.');
    this.updateValueCallback = null;
  }

  private sendNetworks(networks: Network[]): void {
    if (!this.updateValueCallback) {
      console.warn(
        'NetworkListCharacteristic: No subscription active. Cannot send network list.',
      );
      return;
    }

    // Truncate if too long, or implement chunking for production
    const data = Buffer.from(JSON.stringify(networks));

    // Assuming the list fits in one notification. For production, you'd need chunking.
    console.log(
      `NetworkListCharacteristic: Sending network list (${data.length} bytes).`,
    );
    this.updateValueCallback(data);
  }
}
