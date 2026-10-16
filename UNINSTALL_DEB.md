# Beatnik Bleno Service: Debian Package (.deb) Removal

For installations done with the `.deb` package (see [INSTALL_DEB.md](INSTALL_DEB.md)).

## Remove

```bash
sudo apt remove beatnik-bleno
```

This stops and disables the service and deletes `/opt/beatnik-bleno` and `/etc/systemd/system/beatnik-bleno.service`.

To also remove automatically installed dependencies that are no longer needed:

```bash
sudo apt autoremove
```

## Manual Cleanup (Optional)

The package does not revert changes to the boot configuration. To remove the startup LED GPIO settings, edit `/boot/firmware/config.txt` (or `/boot/config.txt` on older systems) and delete these lines:

```
gpio=27,24=op,dl
gpio=17=op,dh
```

Only remove Node.js (`sudo apt remove nodejs`) if nothing else on the system uses it.

## Verify Removal

```bash
systemctl status beatnik-bleno.service
```

This should return `Unit beatnik-bleno.service could not be found.`
