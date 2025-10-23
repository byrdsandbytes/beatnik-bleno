const { exec } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class WiFiManager extends EventEmitter {
    constructor() {
        super();
        this.currentStatus = {
            connected: false,
            ssid: null,
            ip: null,
            message: 'Not connected'
        };
    }

    /**
     * Connect to a WiFi network
     * @param {string} ssid - Network SSID
     * @param {string} password - Network password
     * @returns {Promise<void>}
     */
    async connect(ssid, password) {
        console.log(`\n🔄 Attempting to connect to "${ssid}"...`);
        
        try {
            // Update status
            this.updateStatus({
                connected: false,
                ssid: ssid,
                ip: null,
                message: 'Connecting...'
            });

            // Check the platform
            const platform = process.platform;
            
            if (platform === 'linux') {
                await this.connectLinux(ssid, password);
            } else if (platform === 'darwin') {
                await this.connectMacOS(ssid, password);
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

            // Wait a bit for connection to establish
            await this.sleep(3000);

            // Verify connection
            const connected = await this.verifyConnection(ssid);
            
            if (connected) {
                const ip = await this.getIPAddress();
                this.updateStatus({
                    connected: true,
                    ssid: ssid,
                    ip: ip,
                    message: 'Connected successfully'
                });
                console.log(`✅ Connected to "${ssid}" (IP: ${ip})`);
            } else {
                throw new Error('Connection verification failed');
            }

        } catch (error) {
            this.updateStatus({
                connected: false,
                ssid: ssid,
                ip: null,
                message: `Connection failed: ${error.message}`
            });
            throw error;
        }
    }

    /**
     * Connect to WiFi on Linux (Raspberry Pi)
     */
    async connectLinux(ssid, password) {
        // Use wpa_passphrase and wpa_supplicant for Raspberry Pi
        // This is the most reliable method for Raspberry Pi OS
        
        // Generate WPA configuration
        const wpaConfig = `
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
    ssid="${ssid}"
    psk="${password}"
    key_mgmt=WPA-PSK
}
`;

        // Try using nmcli first (if NetworkManager is available)
        try {
            await this.execCommand(`nmcli device wifi connect "${ssid}" password "${password}"`);
            return;
        } catch (nmcliError) {
            console.log('⚠️  NetworkManager not available, trying wpa_supplicant...');
        }

        // Fallback to wpa_supplicant
        try {
            // Write configuration to temporary file
            const configPath = '/tmp/wpa_supplicant_temp.conf';
            await fs.writeFile(configPath, wpaConfig);

            // Copy to actual location (requires sudo)
            await this.execCommand(`sudo cp ${configPath} /etc/wpa_supplicant/wpa_supplicant.conf`);

            // Restart wpa_supplicant
            await this.execCommand('sudo wpa_cli -i wlan0 reconfigure');

            // Alternatively, use dhclient to get IP
            await this.execCommand('sudo dhclient wlan0');

        } catch (error) {
            console.error('Error configuring wpa_supplicant:', error);
            throw error;
        }
    }

    /**
     * Connect to WiFi on macOS (for development/testing)
     */
    async connectMacOS(ssid, password) {
        try {
            // On macOS, use networksetup
            const command = `networksetup -setairportnetwork en0 "${ssid}" "${password}"`;
            await this.execCommand(command);
        } catch (error) {
            console.error('Error connecting on macOS:', error);
            throw error;
        }
    }

    /**
     * Verify that we're connected to the specified SSID
     */
    async verifyConnection(ssid) {
        try {
            const platform = process.platform;
            let command;

            if (platform === 'linux') {
                // Check iwconfig or iw
                command = 'iwconfig wlan0 2>/dev/null | grep ESSID';
            } else if (platform === 'darwin') {
                command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I';
            } else {
                return false;
            }

            const output = await this.execCommand(command);
            return output.includes(ssid);

        } catch (error) {
            console.error('Error verifying connection:', error);
            return false;
        }
    }

    /**
     * Get the current IP address
     */
    async getIPAddress() {
        try {
            const platform = process.platform;
            let command;

            if (platform === 'linux') {
                command = "ip addr show wlan0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1";
            } else if (platform === 'darwin') {
                command = "ipconfig getifaddr en0";
            } else {
                return null;
            }

            const output = await this.execCommand(command);
            return output.trim() || null;

        } catch (error) {
            console.error('Error getting IP address:', error);
            return null;
        }
    }

    /**
     * Get current WiFi status
     */
    async getStatus() {
        return this.currentStatus;
    }

    /**
     * Update status and emit event
     */
    updateStatus(status) {
        this.currentStatus = { ...this.currentStatus, ...status };
        this.emit('statusChange', this.currentStatus);
    }

    /**
     * Execute a shell command
     */
    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Scan for available networks (optional feature)
     */
    async scanNetworks() {
        try {
            const platform = process.platform;
            let command;

            if (platform === 'linux') {
                command = 'sudo iwlist wlan0 scan | grep ESSID';
            } else if (platform === 'darwin') {
                command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s';
            } else {
                throw new Error('Unsupported platform');
            }

            const output = await this.execCommand(command);
            console.log('📡 Available networks:', output);
            return output;

        } catch (error) {
            console.error('Error scanning networks:', error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new WiFiManager();
