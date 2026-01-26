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
  // Bluetooth Advertise: Pulse Blue (Dimmed)
  ADVERTISING: { 
    command: 'pulse', 
    params: { on_color: [0, 0, 0.2], off_color: [0, 0, 0], fade_in: 1, fade_out: 1 } 
  },
  // Client Connected: Solid Blue (Dimmed)
  CLIENT_CONNECTED: { 
    command: 'set_color', 
    params: { r: 0, g: 0, b: 0.2 } 
  },
  // WiFi Scanning: Pulse Blue/Amber (Dimmed)
  SCANNING: { 
    command: 'pulse', 
    params: { on_color: [0, 0, 0.2], off_color: [0.15, 0.1, 0], fade_in: 0.5, fade_out: 0.5 } 
  },
  // WiFi Connecting: Pulse Green (Dimmed)
  CONNECTING: { 
    command: 'pulse', 
    params: { on_color: [0, 0.2, 0], off_color: [0, 0, 0], fade_in: 0.5, fade_out: 0.5 } 
  },
  // WiFi Provisioned/Connected: Solid Green (Dimmed)
  PROVISIONED: { 
    command: 'set_color', 
    params: { r: 0, g: 0.2, b: 0 } 
  },
  // Error: Fast Blink Red (Dimmed)
  ERROR: { 
    command: 'blink', 
    params: { color: [0.2, 0, 0], on_time: 0.2, off_time: 0.2 } 
  },
  // Button Check Success: Solid Green (Dimmed)
  CHECK_SUCCESS: { 
    command: 'set_color', 
    params: { r: 0, g: 0.2, b: 0 } 
  },
  // Button Check Fail: Solid Red (Dimmed)
  CHECK_FAIL: { 
    command: 'set_color', 
    params: { r: 0.2, g: 0, b: 0 } 
  },
  // Off
  OFF: {
    command: 'off'
  }
} as const;

export type AppConfig = typeof CONFIG;

