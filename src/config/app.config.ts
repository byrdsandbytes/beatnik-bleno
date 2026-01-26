/**
 * Application Configuration
 * Similar to Angular environment files
 */
export const CONFIG = {
  bluetooth: {
    deviceName: 'beatnik',
    serviceUuid: '6E400001B5A3F393E0A9E50E24DCCA9E',
  },
  characteristics: {
    ssidUuid: '6E400002B5A3F393E0A9E50E24DCCA9E',
    passwordUuid: '6E400003B5A3F393E0A9E50E24DCCA9E',
    connectUuid: '6E400004B5A3F393E0A9E50E24DCCA9E',
    statusUuid: '6E400005B5A3F393E0A9E50E24DCCA9E',
    scanNetworksUuid: '6E400006B5A3F393E0A9E50E24DCCA9E', // New
    networkListUuid: '6E400007B5A3F393E0A9E50E24DCCA9E', // New
  },
  wifi: {
    interface: 'wlan0',
    connectionTimeout: 15000,
    verificationTimeout: 10000,
  },
} as const;

export const LED_CONFIG = {
  // Bluetooth Advertise: Pulse Blue
  ADVERTISING: { 
    command: 'pulse', 
    params: { on_color: [0, 0, 1], off_color: [0, 0, 0], fade_in: 1, fade_out: 1 } 
  },
  // Client Connected: Solid Blue
  CLIENT_CONNECTED: { 
    command: 'set_color', 
    params: { r: 0, g: 0, b: 1 } 
  },
  // WiFi Scanning: Pulse Blue/Amber
  SCANNING: { 
    command: 'pulse', 
    params: { on_color: [0, 0, 1], off_color: [1, 0.5, 0], fade_in: 0.5, fade_out: 0.5 } 
  },
  // WiFi Connecting: Pulse Green
  CONNECTING: { 
    command: 'pulse', 
    params: { on_color: [0, 1, 0], off_color: [0, 0, 0], fade_in: 0.5, fade_out: 0.5 } 
  },
  // WiFi Provisioned/Connected: Solid Green
  PROVISIONED: { 
    command: 'set_color', 
    params: { r: 0, g: 1, b: 0 } 
  },
  // Error: Fast Blink Red
  ERROR: { 
    command: 'blink', 
    params: { color: [1, 0, 0], on_time: 0.2, off_time: 0.2 } 
  },
  // Button Check Success: Solid Green
  CHECK_SUCCESS: { 
    command: 'set_color', 
    params: { r: 0, g: 1, b: 0 } 
  },
  // Button Check Fail: Solid Red
  CHECK_FAIL: { 
    command: 'set_color', 
    params: { r: 1, g: 0, b: 0 } 
  },
  // Off
  OFF: {
    command: 'off'
  }
} as const;

export type AppConfig = typeof CONFIG;

