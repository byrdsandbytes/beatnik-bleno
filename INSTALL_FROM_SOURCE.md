# Installing from Source (Developer Guide)

This guide is for developers who want to build and run Beatnik Bleno from source on a Raspberry Pi, including testing a specific branch or pull request before it is released.

---

## Prerequisites

- **OS:** Raspberry Pi OS (Bookworm or newer recommended)
- **Privileges:** Root access (`sudo`) is required for Bluetooth tools and systemd.
- **Node.js:** Version 22 is required.

### Installing Node.js (via NVM)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

nvm install 22
nvm use 22
```

---

## 1. Clone the Repository

```bash
mkdir -p ~/beatnik-bleno
cd ~/beatnik-bleno
git clone https://github.com/byrdsandbytes/beatnik-bleno.git .
```

## 2. Check Out the Branch You Want to Test

```bash
git fetch origin
git checkout <branch-name>
```

To switch to a different branch later:
```bash
git fetch origin
git checkout <other-branch-name>
git pull
```

## 3. Install Dependencies & Build

```bash
npm install
npm run build
```

## 4. Run the Service

### Option A: Run directly (quick iteration, foreground)
```bash
sudo node dist/main.js
```
Useful for quick testing since logs print directly to the terminal and `Ctrl+C` stops it.

### Option B: Run via systemd (persistent, survives reboot)
```bash
# Copy the service file
sudo cp beatnik-bleno.service /etc/systemd/system/

# IMPORTANT: Edit the service file so WorkingDirectory matches where you
# cloned the repo (e.g. /home/<user>/beatnik-bleno) and ExecStart points
# to your Node.js executable (find it with: which node)
sudo nano /etc/systemd/system/beatnik-bleno.service

sudo systemctl daemon-reload
sudo systemctl enable beatnik-bleno.service
sudo systemctl start beatnik-bleno.service
```

---

## Rebuilding After Code Changes

Whenever you pull new changes or switch branches, rebuild and restart:

```bash
git pull
npm install
npm run build
sudo systemctl restart beatnik-bleno.service
```

---

## Checking Service Status & Logs

```bash
sudo systemctl status beatnik-bleno.service
sudo journalctl -u beatnik-bleno.service -f
```

---

## Uninstalling

See [UNINSTALL.md](UNINSTALL.md) for full removal steps.
