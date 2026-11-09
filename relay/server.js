// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Relay — Self-Hostable WebRTC Signaling & TURN Credential Server (CPO-092)
 *
 * Implements:
 * 1. PeerJS signaling protocol (HTTP + WebSocket)
 * 2. Dynamic or static coturn STUN/TURN ICE credential provider (/ice)
 * 3. Health & diagnostics endpoint (/health)
 */

import http from 'http';
import crypto from 'crypto';
import wsPkg from 'ws';

const WebSocket = wsPkg.default || wsPkg;
const WebSocketServer = WebSocket.Server || WebSocket.WebSocketServer || wsPkg.WebSocketServer;

/**
 * Generates Coturn time-limited REST API credentials (RFC 5766 HMAC-SHA1).
 * @param {string} secret
 * @param {string} [usernamePrefix='copio']
 * @param {number} [ttlSeconds=86400]
 * @returns {{ username: string, credential: string }}
 */
export function generateTurnCredentials(secret, usernamePrefix = 'copio', ttlSeconds = 86400) {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${usernamePrefix}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  return { username, credential };
}

/**
 * Builds the ICE server list from environment configuration or parameters.
 * @param {Object} [config]
 * @returns {Array<RTCIceServer>}
 */
export function getIceServerConfig(config = {}) {
  const coturnHost = config.coturnHost || process.env.COTURN_HOST || 'localhost';
  const coturnPort = parseInt(config.coturnPort || process.env.COTURN_PORT || '3478', 10);
  const coturnTlsPort = parseInt(config.coturnTlsPort || process.env.COTURN_TLS_PORT || '5349', 10);
  const secret = config.coturnSecret || process.env.COTURN_SECRET;
  const staticUser = config.coturnUser || process.env.COTURN_USER;
  const staticPassword = config.coturnPassword || process.env.COTURN_PASSWORD;

  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: `stun:${coturnHost}:${coturnPort}` },
  ];

  if (secret) {
    const { username, credential } = generateTurnCredentials(secret, 'copio');
    servers.push({
      urls: [
        `turn:${coturnHost}:${coturnPort}?transport=udp`,
        `turn:${coturnHost}:${coturnPort}?transport=tcp`,
        `turns:${coturnHost}:${coturnTlsPort}?transport=tcp`,
      ],
      username,
      credential,
    });
  } else if (staticUser && staticPassword) {
    servers.push({
      urls: [
        `turn:${coturnHost}:${coturnPort}?transport=udp`,
        `turn:${coturnHost}:${coturnPort}?transport=tcp`,
      ],
      username: staticUser,
      credential: staticPassword,
    });
  }

  return servers;
}

/**
 * Creates and starts the Copio Relay server instance.
 * @param {Object} [options]
 * @param {number} [options.port=9000]
 * @param {string} [options.host='0.0.0.0']
 * @param {string} [options.coturnHost]
 * @param {number} [options.coturnPort]
 * @param {string} [options.coturnSecret]
 * @returns {Promise<{ server: http.Server, wss: WebSocketServer, port: number, close: Function }>}
 */
export function createRelayServer(options = {}) {
  const port = options.port !== undefined ? options.port : parseInt(process.env.PORT || '9000', 10);
  const host = options.host || process.env.HOST || '0.0.0.0';

  /** @type {Map<string, { ws: WebSocket, token: string }>} */
  const peers = new Map();

  const server = http.createServer((req, res) => {
    // Enable CORS for web clients across origins
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === '/health' || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'copio-relay',
          version: '0.1.0',
          uptime: process.uptime(),
          connectedPeers: peers.size,
        })
      );
      return;
    }

    // ICE credentials endpoint (/ice, /:key/ice, /api/v1/ice)
    if (pathname === '/ice' || pathname.endsWith('/ice')) {
      const iceServers = getIceServerConfig(options);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(iceServers));
      return;
    }

    // PeerJS ID allocation endpoint (GET /:key/id)
    if (pathname.endsWith('/id')) {
      const randomId = `peer_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(randomId);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);

    // PeerJS URL structure: /:key/:id/:token/ws or /copio/:id/:token/ws
    let peerId = null;
    let token = null;

    if (parts.length >= 3) {
      peerId = parts[1];
      token = parts[2];
    } else {
      peerId = url.searchParams.get('id') || `peer_${crypto.randomBytes(4).toString('hex')}`;
      token = url.searchParams.get('token') || crypto.randomBytes(4).toString('hex');
    }

    // Register peer
    peers.set(peerId, { ws, token });

    // Send PeerJS OPEN acknowledgment
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'OPEN' }));
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || !msg.type) return;

        // Heartbeats
        if (msg.type === 'HEARTBEAT') {
          return;
        }

        // Route signaling messages (OFFER, ANSWER, CANDIDATE, LEAVE) to destination peer
        const targetId = msg.dst;
        if (targetId && peers.has(targetId)) {
          const target = peers.get(targetId);
          if (target?.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ ...msg, src: peerId }));
          }
        }
      } catch (err) {
        console.warn('[CopioRelay] message parse error:', err);
      }
    });

    const cleanup = () => {
      if (peers.get(peerId)?.ws === ws) {
        peers.delete(peerId);
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const actualPort = /** @type {import('net').AddressInfo} */ (server.address()).port;
      resolve({
        server,
        wss,
        port: actualPort,
        close: () =>
          new Promise((done) => {
            for (const peer of peers.values()) {
              try {
                peer.ws.terminate();
              } catch {
                // ignore
              }
            }
            peers.clear();
            if (typeof server.closeAllConnections === 'function') {
              server.closeAllConnections();
            }
            wss.close(() => {
              server.close(() => done());
            });
          }),
      });
    });
    server.on('error', reject);
  });
}

// Standalone CLI execution
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  createRelayServer().then(({ port }) => {
    console.log(`📡 Copio Relay signaling server running on port ${port}`);
    console.log(`   - Health check: http://localhost:${port}/health`);
    console.log(`   - ICE servers:  http://localhost:${port}/ice`);
  }).catch((err) => {
    console.error('Failed to start Copio Relay:', err);
    process.exit(1);
  });
}
