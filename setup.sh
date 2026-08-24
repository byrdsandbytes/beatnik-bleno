#!/bin/bash

# Exit on error
set -e

echo "🥦 Setting up Beatnik Bleno Service (Production Release)..."

SERVICE_NAME="beatnik-bleno.service"
INSTALL_DIR="/opt/beatnik-bleno"
REPO="byrdsandbytes/beatnik-bleno"

# 1. Stop existing service if running
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "🛑 Stopping existing service..."
    sudo systemctl stop $SERVICE_NAME
fi

# 2. Install System Dependencies (needed for Bleno and downloading)
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y bluetooth bluez libudev-dev libusb-1.0-0-dev network-manager isc-dhcp-client curl build-essential jq

# Unblock Bluetooth and WiFi
echo "🔓 Unblocking Bluetooth and WiFi..."
sudo rfkill unblock bluetooth
sudo rfkill unblock wifi

# Ensure WiFi interface is up (assuming wlan0)
if ip link show wlan0 > /dev/null 2>&1; then
    echo "   Bringing up wlan0..."
    sudo ip link set wlan0 up
fi

# 3. Create Install Directory
echo "📁 Creating installation directory..."
sudo mkdir -p $INSTALL_DIR
sudo chown -R $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# 4. Fetch the latest release artifact from GitHub
echo "⬇️  Downloading latest release from GitHub..."
ASSET_URL=$(curl -s https://api.github.com/repos/$REPO/releases/latest | jq -r '.assets[] | select(.name=="beatnik-bleno.tar.gz") | .browser_download_url')

if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" == "null" ]; then
    echo "❌ Failed to find release asset beatnik-bleno.tar.gz on GitHub."
    exit 1
fi

curl -L -o beatnik-bleno.tar.gz "$ASSET_URL"

# Extract
echo "📦 Extracting..."
tar -xzf beatnik-bleno.tar.gz
rm beatnik-bleno.tar.gz

# 5. Setup Node.js via NVM
echo "🟢 Setting up Node.js (NVM)..."
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "   Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh" --no-use
else
  echo "❌ Failed to locate nvm.sh"
  exit 1
fi

echo "   Installing Node.js v22..."
nvm install 22
nvm use 22

# 6. Install production dependencies
echo "📦 Installing production dependencies..."
npm install --omit=dev

# 7. Configure systemd service
echo "⚙️  Configuring systemd service..."

NODE_PATH=$(which node)

# Create a temporary service file with correct paths
sed -e "s|ExecStart=.*|ExecStart=$NODE_PATH $INSTALL_DIR/dist/main.js|" \
    -e "s|WorkingDirectory=.*|WorkingDirectory=$INSTALL_DIR|" \
    $INSTALL_DIR/beatnik-bleno.service > $INSTALL_DIR/beatnik-bleno.service.tmp

# Copy service file
sudo cp $INSTALL_DIR/beatnik-bleno.service.tmp /etc/systemd/system/$SERVICE_NAME
rm $INSTALL_DIR/beatnik-bleno.service.tmp

# Reload systemd daemon & start
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

echo "🚀 Starting service..."
sudo systemctl restart $SERVICE_NAME

echo "✅ Setup complete! The service is now running in the background."
echo "   Check status with: sudo systemctl status $SERVICE_NAME"
echo "   View logs with: sudo journalctl -u $SERVICE_NAME -f"