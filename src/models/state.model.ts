import { WiFiStatus } from './wifi.model';

export enum ProvisioningState {
  IDLE = 'idle',
  SCANNING = 'scanning',
  CONNECTING_WIFI = 'connecting_wifi',
  PROVISIONED = 'provisioned',
  ERROR = 'error',
}

export enum BleState {
  POWERED_ON = 'poweredOn',
  ADVERTISING = 'advertising',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  UNKNOWN = 'unknown',
}

export enum SystemMode {
  NORMAL = 'normal',
  PENDING_ACTION = 'pending_action',
}

export interface AppState {
  wifiStatus: WiFiStatus;
  provisioning: ProvisioningState;
  ble: BleState;
  systemMode: SystemMode;
  lastError: string | null;
}

export const INITIAL_STATE: AppState = {
  wifiStatus: {
    connected: false,
    ssid: null,
    ip: null,
    hostname: null,
    deviceId: null,
    message: 'Not connected',
  },
  provisioning: ProvisioningState.IDLE,
  ble: BleState.UNKNOWN,
  systemMode: SystemMode.NORMAL,
  lastError: null,
};
