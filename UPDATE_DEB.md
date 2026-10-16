# Beatnik Bleno Service: Debian Package (.deb) Update

For installations done with the `.deb` package (see [INSTALL_DEB.md](INSTALL_DEB.md)).

## Check the Installed Version

```bash
dpkg-query -W beatnik-bleno
```

## Update to the Latest Release

Find the newest version on the [releases page](https://github.com/byrdsandbytes/beatnik-bleno/releases), then download and install it over the existing one:

```bash
VERSION=X.Y.Z   # e.g. 0.7.5
wget https://github.com/byrdsandbytes/beatnik-bleno/releases/download/v${VERSION}/beatnik-bleno_${VERSION}_arm64.deb
sudo apt install ./beatnik-bleno_${VERSION}_arm64.deb
```

`apt` upgrades the package in place: the app files in `/opt/beatnik-bleno` are replaced, any new dependencies are installed, and the service is restarted automatically. A reboot is not required.

## Verify

```bash
dpkg-query -W beatnik-bleno
sudo systemctl status beatnik-bleno.service
sudo journalctl -u beatnik-bleno.service -f
```

## Downgrade / Roll Back

Install an older release the same way, allowing the downgrade:

```bash
sudo apt install --allow-downgrades ./beatnik-bleno_<old-version>_arm64.deb
```
