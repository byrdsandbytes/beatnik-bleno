import { singleton } from 'tsyringe';
import { EventEmitter } from 'events';
import { AppState, INITIAL_STATE, ProvisioningState, BleState } from '../models/state.model';
import { WiFiStatus } from '../models/wifi.model';

@singleton()
export class StateService extends EventEmitter {
  private _state: AppState = JSON.parse(JSON.stringify(INITIAL_STATE)); // Deep copy initial state

  constructor() {
    super();
  }

  /**
   * Get the current state snapshot
   */
  public get state(): AppState {
    return { ...this._state };
  }

  /**
   * Update WiFi status
   * @param status Partial or full WiFiStatus
   */
  public updateWiFiStatus(status: Partial<WiFiStatus>): void {
    this._state.wifiStatus = { ...this._state.wifiStatus, ...status };
    this.emitStateChange();
  }

  /**
   * Update Provisioning State
   * @param state ProvisioningState
   */
  public updateProvisioningState(state: ProvisioningState): void {
    if (this._state.provisioning !== state) {
      this._state.provisioning = state;
      this.emitStateChange();
    }
  }

  /**
   * Update BLE State
   * @param state BleState
   */
  public updateBleState(state: BleState): void {
    if (this._state.ble !== state) {
      this._state.ble = state;
      this.emitStateChange();
    }
  }

  /**
   * Set an error message
   * @param error Error message or null to clear
   */
  public setError(error: string | null): void {
    this._state.lastError = error;
    if (error) {
      this.updateProvisioningState(ProvisioningState.ERROR);
    }
    this.emitStateChange();
  }

  private emitStateChange(): void {
    this.emit('stateChanged', this.state);
  }
}
