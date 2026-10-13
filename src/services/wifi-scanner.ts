import { Network } from '../models/wifi.model';
import { mergeNetworks, parseNetworks } from '../utils/nmcli.util';
import { run, sleep } from '../utils/shell.util';

const POLL_INTERVAL_MS = 1500;
const SCAN_WINDOW_MS = 12_000;
const MIN_SCAN_MS = 5000;
// Consecutive polls with no new SSIDs before the scan counts as settled.
const STABLE_POLLS = 2;
const STALE_RESULT_MAX_AGE_MS = 5 * 60_000;

/**
 * Scans via NetworkManager. `nmcli ... list --rescan yes` returns the cache before the
 * radio finishes scanning (and silently skips the scan if one ran recently), so we trigger
 * a rescan, then poll the cache until the set of SSIDs settles.
 */
export class WiFiScanner {
  private lastResult: { networks: Network[]; at: number } | null = null;

  constructor(private readonly iface: string) {}

  public async scan(): Promise<Network[]> {
    const found = new Map<string, Network>();

    // A failure here means nmcli/NetworkManager is unusable, so let it propagate.
    mergeNetworks(found, await this.readCache());

    const startedAt = Date.now();
    await this.requestRescan();

    const deadline = startedAt + SCAN_WINDOW_MS;
    let stablePolls = 0;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const sizeBefore = found.size;
      try {
        mergeNetworks(found, await this.readCache());
      } catch (error) {
        console.warn(`WiFi scan poll failed: ${(error as Error).message}`);
        continue;
      }

      stablePolls = found.size > 0 && found.size === sizeBefore ? stablePolls + 1 : 0;
      if (stablePolls >= STABLE_POLLS && Date.now() - startedAt >= MIN_SCAN_MS) break;
    }

    const networks = Array.from(found.values()).sort((a, b) => b.quality - a.quality);

    if (networks.length > 0) {
      this.lastResult = { networks, at: Date.now() };
      return networks;
    }

    // The driver sometimes returns nothing while busy; a recent list beats an empty one.
    if (this.lastResult && Date.now() - this.lastResult.at < STALE_RESULT_MAX_AGE_MS) {
      console.warn('WiFi scan returned no networks, falling back to the previous result.');
      return this.lastResult.networks;
    }

    return [];
  }

  private async readCache(): Promise<Network[]> {
    const output = await run('nmcli', [
      '-t', '-f', 'SSID,SIGNAL,SECURITY',
      'device', 'wifi', 'list',
      'ifname', this.iface,
      '--rescan', 'no',
    ]);
    return parseNetworks(output);
  }

  private async requestRescan(): Promise<void> {
    try {
      await run('nmcli', ['device', 'wifi', 'rescan', 'ifname', this.iface]);
    } catch (error) {
      // Typically "Scanning not allowed immediately following previous scan"; the cache is still usable.
      console.warn(`WiFi rescan request rejected: ${(error as Error).message}`);
    }
  }
}
