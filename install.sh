#!/bin/bash

# Exit on error
set -e

echo "🥦 Setting up Beatnik Service..."

# 1. Install System Dependencies (needed for Bleno and other tools)
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y bluetooth bluez libudev-dev libusb-1.0-0-dev network-manager

# 2. Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# 3. Build the project
echo "🔨 Building project..."
npm run build

# 4. Setup Systemd Service
echo "⚙️  Configuring systemd service..."
# Copy service file
sudo cp beatnik.service /etc/systemd/system/beatnik.service

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable beatnik.service

# Start the service now
echo "🚀 Starting service..."
sudo systemctl restart beatnik.service

echo "✅ Setup complete!"
echo "   View logs with: sudo journalctl -u beatnik.service -f"
