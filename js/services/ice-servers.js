/**
 * Fetches ICE (STUN/TURN) server config for WebRTC.
 *
 * PeerJS's built-in TURN servers (eu-0/us-0.turn.peerjs.com) no longer exist,
 * so cross-device connections (especially Brave, which hides host candidates)
 * need a working TURN relay. We use Metered Open Relay; the API key is
 * public by design and should be domain-restricted in the Metered dashboard.
 */
const METERED_URL =
  'https://copio.metered.live/api/v1/turn/credentials?apiKey=d90f0b0b6bdf180ea68238f5c2185074ce37';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

const FETCH_TIMEOUT_MS = 5000;

export async function getIceServers() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
