import { Network } from '../models/wifi.model';

/** Split one line of `nmcli -t` output on unescaped colons, resolving `\:` and `\\`. */
export function splitTerse(line: string): string[] {
  const fields: string[] = [];
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '\\' && i + 1 < line.length) {
      current += line[++i];
    } else if (char === ':') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Parse `nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list` output. Hidden networks are skipped. */
export function parseNetworks(output: string): Network[] {
  const networks = new Map<string, Network>();

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;

    const [ssid, signal = '', security = ''] = splitTerse(line);
    if (!ssid) continue;

    mergeNetworks(networks, [
      {
        ssid,
        quality: parseInt(signal, 10) || 0,
        security: security.trim() === '' || security.trim() === '--' ? 'None' : security.trim(),
      },
    ]);
  }

  return Array.from(networks.values());
}

/** Merge into `target` by SSID, keeping the strongest signal seen. */
export function mergeNetworks(target: Map<string, Network>, incoming: Network[]): void {
  for (const network of incoming) {
    const existing = target.get(network.ssid);
    if (!existing || network.quality > existing.quality) {
      target.set(network.ssid, network);
    }
  }
}
