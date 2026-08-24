# Beatnik Bleno Service: Installation & Updating Guide

This guide covers the necessary steps to install, configure, and maintain the Beatnik Bleno service on your Raspberry Pi. 

There are two primary ways to install the service. **Method 1 (Production Release)** is the most robust and professional choice, as it keeps your Raspberry Pi free of development dependencies and compiling overhead. **Method 2 (Source Script)** is better suited for active development.

---

## 📋 Prerequisites

Before you begin, ensure your Raspberry Pi meets the following requirements:
- **OS:** Raspberry Pi OS (Bookworm or newer recommended)
- **Privileges:** Root access (`sudo`) is required to modify system configuration files, use Bluetooth tools, and manage systemd services.
- **Node.js:** Version 22 is required.

### Installing Node.js (via NVM)
If you don't have Node.js installed, we recommend using NVM (Node Version Manager):

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Install and activate Node.js 22
nvm install 22
nvm use 22
```

---

## 🚀 Installation

### Method 1: Production Setup Script (Recommended)
We provide an automated setup script that downloads the latest pre-built release artifact, installs dependencies, and configures the systemd service. This is the cleanest way to run the service in production.

```bash
wget https://raw.githubusercontent.com/byrdsandbytes/beatnik-bleno/master/setup.sh
chmod +x setup.sh
./setup.sh
```

**What the script does:**
1. Creates the `/opt/beatnik-bleno` directory.
2. Downloads and extracts the latest release artifact from GitHub.
3. Installs Node.js v22 via NVM (if not present).
4. Installs production dependencies (`npm install --omit=dev`).
5. Automatically patches and installs `beatnik-bleno.service` to systemd and starts it.

---

### Method 2: Manual Source Installation (Development)
If you want to build the project directly from source on the Pi itself:

**1. Clone Repository**
```bash
sudo mkdir -p /opt/beatnik-bleno
sudo chown -R $USER:$USER /opt/beatnik-bleno
cd /opt/beatnik-bleno
git clone https://github.com/byrdsandbytes/beatnik-bleno.git .
```

**2. Install Dependencies & Build**
```bash
npm install
npm run build
```

**3. Set up the System Service**
```bash
# Copy the service file
sudo cp beatnik-bleno.service /etc/systemd/system/

# IMPORTANT: Edit the service file to ensure ExecStart points to your Node.js executable
# You can find your node path by running: which node
sudo nano /etc/systemd/system/beatnik-bleno.service

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable beatnik-bleno.service
sudo systemctl start beatnik-bleno.service
```

---

## 🔄 Updating the Service

To make future updates completely seamless, the `setup.sh` script is designed to also act as an updater. 

Whenever a new version (`vX.X.X`) is tagged and pushed to GitHub, an automated CI/CD pipeline (GitHub Actions) instantly builds a new release artifact. You can easily pull this update onto your Raspberry Pi by running the local setup script again:

```bash
cd /opt/beatnik-bleno
./setup.sh
```

**What the updater does:**
1. Checks if the service is currently running, and smoothly stops it.
2. Queries the GitHub API for the latest release of `byrdsandbytes/beatnik-bleno`.
3. Downloads & extracts the new `beatnik-bleno.tar.gz` artifact over the existing installation.
4. Runs `npm install --omit=dev` to sync any new dependencies.
5. Restarts the system service and cleans up.

---

## 🛠 Checking Service Status

Regardless of which method you chose, you can always check if the service is running smoothly via:
```bash
sudo systemctl status beatnik-bleno.service
```

You can also check the live logs to verify Bluetooth advertising and connections:
```bash
sudo journalctl -u beatnik-bleno.service -f
```
