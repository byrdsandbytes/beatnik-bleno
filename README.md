# Beatnik Bleno Service

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

### 🚀 Quick Start (Recommended)

We provide an automated installation script that handles system dependencies, Node.js (via nvm), and sets up the systemd service for you.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/byrdsandbytes/beatnik-bleno.git
    cd beatnik-bleno
    ```

2.  **Run the installer:**
    ```bash
    chmod +x install.sh
    ./install.sh
    ```

    This script will:
    - Install required system packages (`bluetooth`, `bluez`, `network-manager`, etc.)
    - Unblock WiFi and Bluetooth via `rfkill`
    - Install Node.js v22 using `nvm`
    - Install project dependencies (`npm install`)
    - Build the project
    - Register and start the `beatnik-bleno` systemd service

### Manual Installation

If you prefer to set things up manually, follow these steps:

### 1. Install System Dependencies

**On Raspberry Pi / Debian / Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

**Enable Bluetooth:**
```bash
sudo rfkill unblock bluetooth
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
```

### 2. Install Node.js (if not already installed)

It's recommended to use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to install and manage Node.js versions.

**a. Install nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```
After installation, add the following lines to your shell's startup script (e.g., `~/.zshrc`, `~/.bashrc`) to source nvm on startup.

```bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" --no-use # This loads nvm, without auto-using the default version
```

**b. Install Node.js v22**
```bash
nvm install 22
nvm use 22
```

### 3. Clone the Repository

```bash
git clone https://github.com/byrdsandbytes/beatnik-bleno.git
cd beatnik-bleno
```

### 4. Install Dependencies

```bash
npm install
```


### 5. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 6. Grant Bluetooth Permissions (Linux)

To run without sudo:

```bash
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
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

# Reset Bluetooth
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

### WiFi Interface Blocked (RF-kill)

If the WiFi interface is down or blocked (e.g., `Operation not possible due to RF-kill`):

```bash
# Check status
ip link show wlan0

# Unblock WiFi
sudo rfkill unblock wifi

# Bring interface up
sudo ip link set wlan0 up
```

### Viewing Service Logs

To view the live logs of the service for debugging:

```bash
# Follow live logs
sudo journalctl -u beatnik-bleno.service -f

# View last 100 lines
sudo journalctl -u beatnik-bleno.service -n 100 --no-pager
```

### WiFi Scan Returns Empty List

If the WiFi scan returns 0 networks, it is likely that the **WiFi Country Code** is not set. The 5GHz and sometimes 2.4GHz radios are disabled until the regulatory domain is set.

**Fix:**
1.  Run `sudo raspi-config`
2.  Go to **5 Localisation Options** -> **L4 WLAN Country**
3.  Select your country (e.g., `US`, `DE`, `GB`)
4.  Finish and Reboot.

Alternatively, check logs for warnings:
```bash
sudo journalctl -u beatnik-bleno.service -f
```

## Deployment & Auto-Start (Raspberry Pi)

The easiest way to deploy the service on a Raspberry Pi is using the included installation script.

### Option 1: Automated Installation (Recommended)

1.  **Clone the repository** to your Raspberry Pi (e.g., in `/home/pi/beatnik-bleno`).
2.  **Run the install script**:
    ```bash
    chmod +x install.sh
    ./install.sh
    ```

This script handles everything for you:
*   Installs system dependencies (`bluetooth`, `bluez`, `network-manager`, `isc-dhcp-client`).
*   Unblocks Bluetooth and WiFi (`rfkill`).
*   Installs Node.js dependencies and builds the project.
*   Configures and starts the `beatnik-bleno.service` systemd unit, automatically detecting your Node.js path (compatible with `nvm`).

### Option 2: Manual Service Setup

If you prefer to set it up manually:

1.  **Modify the service file**:
    Edit `beatnik-bleno.service` and update `ExecStart` and `WorkingDirectory` with your actual paths.
    ```ini
    [Service]
    ...
    WorkingDirectory=/home/pi/beatnik-bleno
    ExecStart=/usr/bin/node /home/pi/beatnik-bleno/dist/main.js
    ...
    ```
    *Note: If using nvm, find your node path with `which node` and use that absolute path.*

2.  **Install the service**:
    ```bash
    sudo cp beatnik-bleno.service /etc/systemd/system/beatnik-bleno.service
    sudo systemctl daemon-reload
    sudo systemctl enable beatnik-bleno.service
    sudo systemctl start beatnik-bleno.service
    ```

### Managing the Service

*   **Check Status:** `sudo systemctl status beatnik-bleno.service`
*   **View Logs:** `sudo journalctl -u beatnik-bleno.service -f`
*   **Stop Service:** `sudo systemctl stop beatnik-bleno.service`
*   **Restart Service:** `sudo systemctl restart beatnik-bleno.service`

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

AGPLv3

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Credits

Built with [@abandonware/bleno](https://github.com/abandonware/bleno) - A maintained fork of the original Bleno library.
