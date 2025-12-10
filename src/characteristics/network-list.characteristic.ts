import { Characteristic, Descriptor } from '@abandonware/bleno';
import { inject, injectable } from 'tsyringe';
import { CONFIG } from '../config/app.config';
import { WiFiManagerService } from '../services/wifi-manager.service';
import { Network } from '../models/wifi.model';

@injectable()
export class NetworkListCharacteristic extends Characteristic {
  private updateValueCallback: ((data: Buffer) => void) | null = null;
  private maxValueSize = 20;

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
    this.maxValueSize = maxValueSize;
    this.updateValueCallback = updateValueCallback;
  }

  onUnsubscribe(): void {
    console.log('NetworkListCharacteristic: Client unsubscribed.');
    this.updateValueCallback = null;
  }

  private async sendNetworks(networks: Network[]): Promise<void> {
    if (!this.updateValueCallback) {
      console.warn(
        'NetworkListCharacteristic: No subscription active. Cannot send network list.',
      );
      return;
    }

    const json = JSON.stringify(networks);
    const data = Buffer.from(json);

    console.log(
      `NetworkListCharacteristic: Sending network list (${data.length} bytes) in chunks of ${this.maxValueSize}.`,
    );

    let offset = 0;
    while (offset < data.length) {
      const end = Math.min(offset + this.maxValueSize, data.length);
      const chunk = data.slice(offset, end);
      
      if (this.updateValueCallback) {
          this.updateValueCallback(chunk);
      }
      
      offset += this.maxValueSize;
      
      // Small delay to ensure packets are processed by the stack
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    // Send a specialized "End of Transmission" marker if we want to be explicit,
    // but for now, we'll rely on the client accumulating data.
    // To make it easier for the client to know when to stop, we could send a null byte or similar,
    // but standard JSON doesn't have a null byte.
    // Let's just send the data.
  }
}
