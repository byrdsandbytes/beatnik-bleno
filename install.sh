#!/bin/bash

# Exit on error
set -e

echo "🥦 Setting up Beatnik Service..."

# 1. Install System Dependencies (needed for Bleno and other tools)
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y bluetooth bluez libudev-dev libusb-1.0-0-dev network-manager isc-dhcp-client curl build-essential

# Unblock Bluetooth
echo "🔓 Unblocking Bluetooth..."
sudo rfkill unblock bluetooth

# 1.5 Setup Node.js via NVM
echo "🟢 Setting up Node.js (NVM)..."
export NVM_DIR="$HOME/.nvm"

# Install NVM if not found
if [ ! -d "$NVM_DIR" ]; then
  echo "   Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# Load NVM
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use Node.js 22
echo "   Installing Node.js v22..."
nvm install 22
nvm use 22
nvm alias default 22

# 2. Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# 3. Build the project
echo "🔨 Building project..."
npm run build

# 4. Setup Systemd Service
echo "⚙️  Configuring systemd service..."

# Get current node path and repo path
NODE_PATH=$(which node)
REPO_PATH=$(pwd)

echo "   Node path: $NODE_PATH"
echo "   Repo path: $REPO_PATH"

# Create a temporary service file with correct paths
sed -e "s|ExecStart=.*|ExecStart=$NODE_PATH $REPO_PATH/dist/main.js|" \
    -e "s|WorkingDirectory=.*|WorkingDirectory=$REPO_PATH|" \
    beatnik-bleno.service > beatnik-bleno.service.tmp

# Copy service file
sudo cp beatnik-bleno.service.tmp /etc/systemd/system/beatnik-bleno.service
rm beatnik-bleno.service.tmp

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable beatnik-bleno.service

# Start the service now
echo "🚀 Starting service..."
sudo systemctl restart beatnik-bleno.service

echo "✅ Setup complete!"
echo "   View logs with: sudo journalctl -u beatnik-bleno.service -f"
