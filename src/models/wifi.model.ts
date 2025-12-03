/**
 * WiFi Credentials Interface
 */
export interface WiFiCredentials {
  ssid: string;
  password: string;
}

/**
 * WiFi Connection Status Interface
 */
export interface WiFiStatus {
  connected: boolean;
  ssid: string | null;
  ip: string | null;
  hostname: string | null;
  deviceId: string | null;
  message: string;
}

/**
 * Platform Type
 */
export enum Platform {
  LINUX = 'linux',
  DARWIN = 'darwin',
  WIN32 = 'win32'
}

/**
 * Connection State
 */
export enum ConnectionState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed',
  DISCONNECTED = 'disconnected'
}

export interface Network {
  ssid: string;
  quality: number;
  security: string;
}
