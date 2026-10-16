# Beatnik Bleno Service: Debian Package (.deb) Installation

The recommended way to install the service on a Raspberry Pi is the pre-built `.deb` package attached to every [GitHub release](https://github.com/byrdsandbytes/beatnik-bleno/releases). Production dependencies are bundled, so no `npm` or compiling is needed on the Pi.

## Prerequisites

- **OS:** 64-bit Raspberry Pi OS / Debian (Bookworm or newer). The package is built for `arm64`; check with `dpkg --print-architecture`.
- **Node.js 22** installed from a system package (e.g. NodeSource) providing `/usr/bin/node`. Node installed via NVM is **not** detected by `apt`.
- **Privileges:** `sudo`.

Install Node.js 22 via NodeSource if needed:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Install

Download the latest `.deb` and install it with `apt` (which also pulls in `bluez`, `network-manager`, etc.):

```bash
VERSION=X.Y.Z   # e.g. 0.7.4
wget https://github.com/byrdsandbytes/beatnik-bleno/releases/download/v${VERSION}/beatnik-bleno_${VERSION}_arm64.deb
sudo apt install ./beatnik-bleno_${VERSION}_arm64.deb
```

**What the package does:**
1. Installs the app to `/opt/beatnik-bleno`.
2. Installs `/etc/systemd/system/beatnik-bleno.service`.
3. Adds the startup LED GPIO settings to `/boot/firmware/config.txt` (or `/boot/config.txt`) if missing.
4. Unblocks Bluetooth and WiFi, then enables and starts the service.

A reboot is needed once for the GPIO LED settings to take effect.

## Update

See [UPDATE_DEB.md](UPDATE_DEB.md).

## Check Status and Logs

```bash
sudo systemctl status beatnik-bleno.service
sudo journalctl -u beatnik-bleno.service -f
```

To remove the package, see [UNINSTALL_DEB.md](UNINSTALL_DEB.md).
