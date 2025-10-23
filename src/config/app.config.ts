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
  },
  wifi: {
    interface: 'wlan0',
    connectionTimeout: 3000,
    verificationTimeout: 5000,
  },
} as const;

export type AppConfig = typeof CONFIG;
