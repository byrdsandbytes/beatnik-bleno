# Beatnik Bleno Service: Uninstallation Guide

This guide covers how to fully remove the Beatnik Bleno service from your Raspberry Pi, regardless of whether it was installed via the setup script (Method 1) or from source (Method 2).

---

## 1. Stop and Disable the Service

```bash
sudo systemctl stop beatnik-bleno.service
sudo systemctl disable beatnik-bleno.service
```

## 2. Remove the systemd Service File

```bash
sudo rm /etc/systemd/system/beatnik-bleno.service
sudo systemctl daemon-reload
sudo systemctl reset-failed
```

## 3. Remove the Application Directory

```bash
rm -rf ~/beatnik-bleno
```

## 4. (Optional) Remove Node.js / NVM

Only do this if Node.js/NVM was installed solely for this service and is not needed by anything else.

```bash
nvm uninstall 22
rm -rf ~/.nvm
```

Then remove the NVM init lines from your shell profile (e.g. `~/.bashrc`):

```bash
# Remove any lines similar to:
# export NVM_DIR="$HOME/.nvm"
# [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

---

## Verifying Removal

Confirm the service is gone and no longer running:

```bash
systemctl status beatnik-bleno.service
```

This should return `Unit beatnik-bleno.service could not be found.`
