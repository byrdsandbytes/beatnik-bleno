// Import the maintained Bleno library
const bleno = require('@abandonware/bleno');
const wifiManager = require('./wifi-manager');

// --- Your Settings ---
const DEVICE_NAME = 'beatnik'; // This is all you need for the name!
const SERVICE_UUID = '6E400001B5A3F393E0A9E50E24DCCA9E'; // Nordic UART Service
const SSID_CHAR_UUID = '6E400002B5A3F393E0A9E50E24DCCA9E';
const PASSWORD_CHAR_UUID = '6E400003B5A3F393E0A9E50E24DCCA9E';
const CONNECT_CHAR_UUID = '6E400004B5A3F393E0A9E50E24DCCA9E';
const STATUS_CHAR_UUID = '6E400005B5A3F393E0A9E50E24DCCA9E';

// Store WiFi credentials
let wifiCredentials = {
    ssid: '',
    password: ''
};

// --- SSID Characteristic ---
class SsidCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: SSID_CHAR_UUID,
            properties: ['write', 'writeWithoutResponse'],
            descriptors: [
                new bleno.Descriptor({
                    uuid: '2901', // User Description
                    value: 'Wi-Fi SSID'
                })
            ]
        });
    }

    // Called when a client writes to this characteristic
    onWriteRequest(data, offset, withoutResponse, callback) {
        if (offset) {
            callback(this.RESULT_ATTR_NOT_LONG);
            return;
        }

        wifiCredentials.ssid = data.toString('utf8');
        console.log(`📡 SSID set to: ${wifiCredentials.ssid}`);
        
        // Signal success
        callback(this.RESULT_SUCCESS);
    }
}

// --- Password Characteristic ---
class PasswordCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: PASSWORD_CHAR_UUID,
            properties: ['write', 'writeWithoutResponse'],
            descriptors: [
                new bleno.Descriptor({
                    uuid: '2901', // User Description
                    value: 'Wi-Fi Password'
                })
            ]
        });
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        if (offset) {
            callback(this.RESULT_ATTR_NOT_LONG);
            return;
        }

        wifiCredentials.password = data.toString('utf8');
        console.log(`🔐 Password set (${wifiCredentials.password.length} characters)`);
        
        callback(this.RESULT_SUCCESS);
    }
}

// --- Connect Characteristic ---
class ConnectCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: CONNECT_CHAR_UUID,
            properties: ['write', 'writeWithoutResponse'],
            descriptors: [
                new bleno.Descriptor({
                    uuid: '2901', // User Description
                    value: 'Connect to Wi-Fi (write 1 to connect)'
                })
            ]
        });
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        if (offset) {
            callback(this.RESULT_ATTR_NOT_LONG);
            return;
        }

        const command = data.readUInt8(0);
        
        if (command === 1) {
            console.log('\n🔄 Connection request received!');
            console.log(`   SSID: ${wifiCredentials.ssid}`);
            console.log(`   Password: ${'*'.repeat(wifiCredentials.password.length)}`);
            
            if (!wifiCredentials.ssid) {
                console.error('❌ Error: SSID not set');
                callback(this.RESULT_UNLIKELY_ERROR);
                return;
            }

            // Attempt to connect to WiFi
            wifiManager.connect(wifiCredentials.ssid, wifiCredentials.password)
                .then(() => {
                    console.log('✅ Successfully connected to WiFi!');
                    callback(this.RESULT_SUCCESS);
                })
                .catch((err) => {
                    console.error('❌ WiFi connection failed:', err.message);
                    callback(this.RESULT_UNLIKELY_ERROR);
                });
        } else {
            callback(this.RESULT_SUCCESS);
        }
    }
}

// --- Status Characteristic (Read-only) ---
class StatusCharacteristic extends bleno.Characteristic {
    constructor() {
        super({
            uuid: STATUS_CHAR_UUID,
            properties: ['read', 'notify'],
            descriptors: [
                new bleno.Descriptor({
                    uuid: '2901', // User Description
                    value: 'Connection Status'
                })
            ]
        });

        this._updateValueCallback = null;
    }

    onReadRequest(offset, callback) {
        wifiManager.getStatus()
            .then((status) => {
                const statusStr = JSON.stringify(status);
                const data = Buffer.from(statusStr, 'utf8');
                
                if (offset > data.length) {
                    callback(this.RESULT_INVALID_OFFSET, null);
                } else {
                    callback(this.RESULT_SUCCESS, data.slice(offset));
                }
            })
            .catch((err) => {
                console.error('Error getting status:', err);
                callback(this.RESULT_UNLIKELY_ERROR, null);
            });
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('📱 Client subscribed to status notifications');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('📱 Client unsubscribed from status notifications');
        this._updateValueCallback = null;
    }

    // Method to send status updates to subscribed clients
    sendStatusUpdate(status) {
        if (this._updateValueCallback) {
            const statusStr = JSON.stringify(status);
            const data = Buffer.from(statusStr, 'utf8');
            this._updateValueCallback(data);
        }
    }
}

// Create characteristic instances
const statusCharacteristic = new StatusCharacteristic();

// --- Main ---

console.log('🚀 Starting Beatnik WiFi Provisioning Service...\n');

// 1. Wait for the Bluetooth adapter to be 'poweredOn'
bleno.on('stateChange', (state) => {
    console.log(`📶 Bluetooth adapter state: ${state}`);

    if (state === 'poweredOn') {
        // 2. Once on, start advertising
        bleno.startAdvertising(DEVICE_NAME, [SERVICE_UUID], (err) => {
            if (err) {
                console.error('❌ Error starting advertising:', err);
            }
        });
    } else {
        console.log('⚠️  Bluetooth not ready, stopping advertising...');
        bleno.stopAdvertising();
    }
});

// 3. Define our services
bleno.on('advertisingStart', (err) => {
    if (err) {
        console.error('❌ Error on advertising start:', err);
        return;
    }
    
    console.log(`\n✅ Advertising as "${DEVICE_NAME}"`);
    console.log(`   Service UUID: ${SERVICE_UUID}`);
    console.log('\n📋 Available characteristics:');
    console.log(`   • SSID:     ${SSID_CHAR_UUID}`);
    console.log(`   • Password: ${PASSWORD_CHAR_UUID}`);
    console.log(`   • Connect:  ${CONNECT_CHAR_UUID}`);
    console.log(`   • Status:   ${STATUS_CHAR_UUID}`);
    console.log('\n💡 Waiting for client connection...\n');
    
    // Create our service and characteristics
    const myService = new bleno.PrimaryService({
        uuid: SERVICE_UUID,
        characteristics: [
            new SsidCharacteristic(),
            new PasswordCharacteristic(),
            new ConnectCharacteristic(),
            statusCharacteristic
        ]
    });

    // 4. Set the services
    bleno.setServices([myService], (err) => {
        if (err) {
            console.error('❌ Error setting services:', err);
        } else {
            console.log('✅ Services configured successfully.');
        }
    });
});

// Handle client connections
bleno.on('accept', (clientAddress) => {
    console.log(`\n🔗 Client connected: ${clientAddress}`);
});

bleno.on('disconnect', (clientAddress) => {
    console.log(`\n🔌 Client disconnected: ${clientAddress}`);
});

// Handle WiFi status changes
wifiManager.on('statusChange', (status) => {
    console.log('📊 WiFi status changed:', status);
    statusCharacteristic.sendStatusUpdate(status);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    bleno.stopAdvertising();
    bleno.disconnect();
    process.exit(0);
});

console.log('💡 Press Ctrl+C to stop the service.\n');
