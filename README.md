# Beatnik WiFi Provisioning Service

A Bluetooth Low Energy (BLE) WiFi provisioning service for Raspberry Pi and other Linux devices using Bleno. Built with **TypeScript** and Angular-style architecture patterns including dependency injection, decorators, and service-based design.

## Features

- **BLE WiFi Provisioning** - Configure WiFi without needing physical access
- **Four BLE Characteristics**:
  - SSID input
  - Password input
  - Connection trigger
  - Status monitoring (with notifications)
- **Cross-platform** - Works on Linux (Raspberry Pi) and macOS (for testing)
- **Secure** - Credentials are transmitted over BLE (ensure you use BLE security features in production)
- **TypeScript** - Fully typed with Angular-style architecture
- **Dependency Injection** - Using tsyringe for clean, testable code
- **Service-based Architecture** - Familiar patterns for Angular developers

## Prerequisites

### Hardware
- Raspberry Pi (or any Linux device with Bluetooth)
- Bluetooth 4.0+ adapter (built-in on Raspberry Pi 3/4/Zero W)

### Software
- Node.js (v10 or higher)
- Bluetooth libraries

## Installation

### Quick Install (Recommended)

For a fast and reliable setup on a Raspberry Pi or other Debian-based Linux system, use the automated setup script. This script will:
- Install `nvm` (Node Version Manager) if not present.
- Install the correct version of Node.js.
- Install required system dependencies (`bluez`, `libbluetooth-dev`, etc.).
- Configure the Bluetooth hardware (`rfkill`, `hciconfig`).
- Install project dependencies (`npm install`).
- Build the project.
- Grant Node.js the necessary capabilities to run without `sudo`.

```bash
git clone https://github.com/byrdsandbytes/beatnik-bleno.git
cd beatnik-bleno
chmod +x setup.sh
./setup.sh
```
*Note: The script will prompt for your password to install system packages and set permissions.*

### Environment Verification

If you encounter issues or want to validate your environment at any time, use the `verify-setup.sh` script. It checks all the same points as the setup script and reports the status of your system.

```bash
chmod +x verify-setup.sh
./verify-setup.sh
```

### Manual Installation

If you prefer to install dependencies manually, follow these steps.

#### 1. Install System Dependencies

**On Raspberry Pi / Debian / Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

**Enable Bluetooth:**
```bash
# Unblock if necessary
sudo rfkill unblock bluetooth
# Bring the interface up
sudo hciconfig hci0 up
# Enable the service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
```

#### 2. Install Node.js (using nvm)

It's recommended to use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager).

**a. Install nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```
After installation, add the following lines to your shell's startup script (e.g., `~/.zshrc`, `~/.bashrc`) to source nvm on startup. Then, restart your terminal.

```bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" --no-use # This loads nvm, without auto-using the default version
```

**b. Install Node.js**
```bash
# From the project directory
nvm install
nvm use
```

#### 3. Clone the Repository

```bash
git clone https://github.com/byrdsandbytes/beatnik-bleno.git
cd beatnik-bleno
```

#### 4. Install Dependencies

```bash
npm install
```


#### 5. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

#### 6. Grant Bluetooth Permissions (Linux)

To run without sudo:

```bash
sudo setcap cap_net_raw+eip $(which node)
```

## Project Structure

```
beatnik-bleno/
├── src/
│   ├── main.ts                          # Application bootstrap (like Angular's main.ts)
│   ├── config/
│   │   └── app.config.ts                # Configuration (like environment.ts)
│   ├── models/
│   │   └── wifi.model.ts                # TypeScript interfaces and enums
│   ├── services/
│   │   └── wifi-manager.service.ts      # WiFi management service (@injectable)
│   └── characteristics/
│       └── base.characteristic.ts       # BLE characteristics (SSID, Password, etc.)
├── dist/                                # Compiled JavaScript output
├── tsconfig.json                        # TypeScript configuration
└── package.json
```

## Usage

### Start the Service

**Production (compiled):**
```bash
npm start
```

**Development (with ts-node):**
```bash
npm run dev
```

**Watch mode (auto-recompile on changes):**
```bash
npm run watch
```

Or with sudo (if you didn't set capabilities):

```bash
sudo npm start
```

You should see output like:

```
Starting Beatnik WiFi Provisioning Service...

Bluetooth adapter state: poweredOn

Advertising as "beatnik"
   Service UUID: 6E400001B5A3F393E0A9E50E24DCCA9E

Available characteristics:
   • SSID:     6E400002B5A3F393E0A9E50E24DCCA9E
   • Password: 6E400003B5A3F393E0A9E50E24DCCA9E
   • Connect:  6E400004B5A3F393E0A9E50E24DCCA9E
   • Status:   6E400005B5A3F393E0A9E50E24DCCA9E

Waiting for client connection...
```

### Connect from a BLE Client

Use any BLE scanner app (like nRF Connect for iOS/Android) or a custom app:

1. **Scan** for devices named "beatnik"
2. **Connect** to the device
3. **Find** the service with UUID `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
4. **Write** your WiFi SSID to characteristic `6E400002...`
5. **Write** your WiFi password to characteristic `6E400003...`
6. **Write** value `0x01` to characteristic `6E400004...` to trigger connection
7. **Read** or **subscribe** to characteristic `6E400005...` to monitor status

### Example with nRF Connect

1. Open nRF Connect app
2. Scan and connect to "beatnik"
3. Discover services
4. Write to characteristics:
   - SSID: `"MyWiFiNetwork"` (UTF-8)
   - Password: `"mypassword123"` (UTF-8)
   - Connect: `0x01` (UINT8)
5. Read Status to check connection result

## API / Characteristics

| Characteristic | UUID | Properties | Description |
|---------------|------|------------|-------------|
| **SSID** | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` | Write | WiFi network name (UTF-8 string) |
| **Password** | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` | Write | WiFi password (UTF-8 string) |
| **Connect** | `6E400004-B5A3-F393-E0A9-E50E24DCCA9E` | Write | Write `1` to trigger connection |
| **Status** | `6E400005-B5A3-F393-E0A9-E50E24DCCA9E` | Read, Notify | JSON status object |

### Status Response Format

```json
{
  "connected": true,
  "ssid": "MyWiFiNetwork",
  "ip": "192.168.1.100",
  "message": "Connected successfully"
}
```

## Configuration

Edit `src/config/app.config.ts` to customize:

```typescript
export const CONFIG = {
  bluetooth: {
    deviceName: 'beatnik', // BLE device name
    serviceUuid: '6E400001B5A3F393E0A9E50E24DCCA9E', // Service UUID
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
```

## Architecture (Angular-style)

This project follows Angular conventions for familiarity:

### Dependency Injection

Services use the `@injectable()` decorator and are registered in the DI container:

```typescript
@injectable()
export class WiFiManagerService extends EventEmitter {
  // Service implementation
}
```

### Service Pattern

The `WiFiManagerService` handles all WiFi operations as a singleton service, similar to Angular services.

### Bootstrap Pattern

`src/main.ts` contains the application bootstrap logic, similar to Angular's `main.ts`:

```typescript
class BeatnikApplication {
  private setupDependencyInjection(): void {
    container.registerSingleton('WiFiManagerService', WiFiManagerService);
  }
  
  public async bootstrap(): Promise<void> {
    // Initialize application
  }
}
```

### Models & Interfaces

TypeScript interfaces define data structures in `src/models/`:

```typescript
export interface WiFiCredentials {
  ssid: string;
  password: string;
}

export interface WiFiStatus {
  connected: boolean;
  ssid: string | null;
  ip: string | null;
  message: string;
}
```

## Troubleshooting

### Bluetooth not working
```bash
# Check Bluetooth status
hciconfig

# If the device (e.g., hci0) is shown as DOWN, bring it up:
sudo hciconfig hci0 up

# If you get an "RF-kill" error, unblock Bluetooth:
sudo rfkill unblock bluetooth
# Then try bringing the interface up again:
sudo hciconfig hci0 up

# Reset Bluetooth if needed
sudo hciconfig hci0 down
sudo hciconfig hci0 up
```

### Permission denied errors
```bash
# Run with sudo or set capabilities
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

### WiFi not connecting

Check that:
- SSID and password are correct
- WiFi network is in range
- Your device's WiFi interface is enabled (`wlan0` on most Pi setups)

```bash
# Check WiFi interface
ifconfig wlan0

# Manual test connection
sudo nmcli device wifi connect "SSID" password "PASSWORD"
```

## Running on Boot (Systemd Service)

Create `/etc/systemd/system/beatnik-wifi.service`:

```ini
[Unit]
Description=Beatnik WiFi Provisioning Service
After=network.target bluetooth.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/beatnik-bleno
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable beatnik-wifi
sudo systemctl start beatnik-wifi

# Check status
sudo systemctl status beatnik-wifi
```

## Development

### TypeScript Development

**Build the project:**
```bash
npm run build
```

**Watch mode (auto-rebuild):**
```bash
npm run watch
```

**Run without building (ts-node):**
```bash
npm run dev
```

**Clean build artifacts:**
```bash
npm run clean
```

### Testing on macOS

The service works on macOS for development/testing purposes, though WiFi connection functionality is limited. The BLE advertising and characteristic handling can be fully tested.

### Adding More Features

You can extend the service by creating new characteristic classes in `src/characteristics/`:

```typescript
@injectable()
export class MyCustomCharacteristic extends BaseCharacteristic {
  constructor(@inject('WiFiManagerService') private wifiManager: WiFiManagerService) {
    super('YOUR-UUID-HERE', ['read', 'write'], 'Description');
  }
  
  onReadRequest(offset: number, callback: (result: number, data?: Buffer) => void): void {
    // Implementation
  }
}
```

Then register it in `src/main.ts`:

```typescript
container.register('MyCustomCharacteristic', { useClass: MyCustomCharacteristic });
```

## Security Considerations

**Important for Production:**

- This example transmits credentials in plain text over BLE
- Use BLE pairing and encryption for production
- Implement authentication mechanisms
- Consider using BLE Secure Connections
- Limit the time window for provisioning
- Add rate limiting for connection attempts

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Credits

Built with [@abandonware/bleno](https://github.com/abandonware/bleno) - A maintained fork of the original Bleno library.
