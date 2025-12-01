#!/bin/bash

# Exit on error
set -e

echo "🥦 Setting up Beatnik Service..."

# 1. Install System Dependencies (needed for Bleno and other tools)
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y bluetooth bluez libudev-dev libusb-1.0-0-dev network-manager

# Unblock Bluetooth
echo "🔓 Unblocking Bluetooth..."
sudo rfkill unblock bluetooth

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
