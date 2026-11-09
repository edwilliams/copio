// SPDX-License-Identifier: AGPL-3.0
/**
 * Fetches ICE (STUN/TURN) server config for WebRTC (CPO-092).
 *
 * Supports Copio's managed TURN relay (Metered Open Relay), custom self-hosted
 * Copio Relay deployments via relayUrl, and direct iceServers overrides.
 */
export const METERED_URL =
  'https://copio.metered.live/api/v1/turn/credentials?apiKey=d90f0b0b6bdf180ea68238f5c2185074ce37';

export const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

const FETCH_TIMEOUT_MS = 5000;

/**
 * Parses a relay or signaling URL string into PeerJS-compatible connection options.
 * @param {string} [relayUrl]
 * @returns {{ host: string, port: number, path: string, secure: boolean, origin: string } | null}
 */
export function parseRelayUrl(relayUrl) {
  if (!relayUrl || typeof relayUrl !== 'string') return null;
  try {
    const u = new URL(relayUrl);
    const secure = u.protocol === 'https:' || u.protocol === 'wss:';
    const defaultPort = secure ? 443 : 80;
    const port = u.port ? parseInt(u.port, 10) : defaultPort;
    let path = u.pathname || '/';
    if (!path.endsWith('/')) path += '/';
    return {
      host: u.hostname,
      port,
      path,
      secure,
      origin: u.origin,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves ICE (STUN/TURN) servers for WebRTC peer connections.
 * @param {Object} [options]
 * @param {Array<RTCIceServer>} [options.iceServers] - Direct ICE server list override
 * @param {string} [options.relayUrl] - Self-hosted or custom Copio Relay base URL
 * @returns {Promise<Array<RTCIceServer>>}
 */
export async function getIceServers(options = {}) {
  // Direct array passed
  if (Array.isArray(options)) {
    return options;
  }

  // Explicit iceServers option
  if (Array.isArray(options?.iceServers) && options.iceServers.length > 0) {
    return options.iceServers;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // If a custom relayUrl is provided, query its /ice endpoint first
  if (options?.relayUrl && typeof options.relayUrl === 'string') {
    try {
      const base = options.relayUrl.replace(/\/$/, '');
      const endpoint = base.endsWith('/ice') ? base : `${base}/ice`;
      const res = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const servers = Array.isArray(data) ? data : data?.iceServers;
        if (Array.isArray(servers) && servers.length > 0) {
          return servers;
        }
      }
    } catch (err) {
      console.warn('[Relay] Failed to fetch ICE credentials from custom relayUrl, trying managed relay:', err);
    }
  }

  // Default managed Copio Relay (Metered TURN)
  try {
    const res = await fetch(METERED_URL, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const servers = await res.json();
    if (!Array.isArray(servers) || servers.length === 0) throw new Error('Empty ICE server list');
    return [{ urls: 'stun:stun.l.google.com:19302' }, ...servers];
  } catch (err) {
    console.warn('[Sync] Failed to fetch TURN credentials, using STUN only:', err);
    return FALLBACK_ICE_SERVERS;
  } finally {
    clearTimeout(timer);
  }
}
