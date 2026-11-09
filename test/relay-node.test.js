// SPDX-License-Identifier: AGPL-3.0
import test from 'node:test';
import assert from 'node:assert/strict';
import wsPkg from 'ws';

const WebSocket = wsPkg.default || wsPkg;
import {
  createRelayServer,
  generateTurnCredentials,
  getIceServerConfig,
} from '../relay/server.js';
import { parseRelayUrl, getIceServers } from '../js/services/ice-servers.js';

test('parseRelayUrl parses HTTP, HTTPS, and custom ports into PeerJS options', () => {
  const parsed1 = parseRelayUrl('https://relay.example.com:9000/copio');
  assert.equal(parsed1.host, 'relay.example.com');
  assert.equal(parsed1.port, 9000);
  assert.equal(parsed1.path, '/copio/');
  assert.equal(parsed1.secure, true);

  const parsed2 = parseRelayUrl('http://localhost:3000');
  assert.equal(parsed2.host, 'localhost');
  assert.equal(parsed2.port, 3000);
  assert.equal(parsed2.path, '/');
  assert.equal(parsed2.secure, false);

  assert.equal(parseRelayUrl(null), null);
  assert.equal(parseRelayUrl('not-a-valid-url'), null);
});

test('generateTurnCredentials generates valid RFC 5766 HMAC credentials', () => {
  const secret = 'test_secret_123';
  const creds = generateTurnCredentials(secret, 'copio_user', 3600);
  assert.ok(creds.username.includes(':copio_user'));
  assert.ok(typeof creds.credential === 'string' && creds.credential.length > 10);
});

test('getIceServerConfig builds STUN and TURN configurations with secret', () => {
  const config = getIceServerConfig({
    coturnHost: 'turn.copio.test',
    coturnPort: 3478,
    coturnSecret: 'super_secret',
  });
  assert.ok(Array.isArray(config));
  assert.ok(config.length >= 3);
  assert.equal(config[0].urls, 'stun:stun.l.google.com:19302');
  assert.equal(config[1].urls, 'stun:turn.copio.test:3478');
  assert.ok(config[2].username.includes(':copio'));
  assert.ok(config[2].credential);
});

test('createRelayServer runs health, ICE discovery, and WebSocket signaling', async () => {
  const relay = await createRelayServer({
    port: 0,
    coturnHost: 'localhost',
    coturnPort: 3478,
    coturnSecret: 'test_relay_secret',
  });

  const baseUrl = `http://localhost:${relay.port}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'ok');
    assert.equal(healthData.service, 'copio-relay');

    // 2. ICE discovery endpoint (/ice)
    const iceRes = await fetch(`${baseUrl}/ice`);
    assert.equal(iceRes.status, 200);
    const iceData = await iceRes.json();
    assert.ok(Array.isArray(iceData));
    assert.ok(iceData.some((s) => s.urls === 'stun:stun.l.google.com:19302'));
    assert.ok(iceData.some((s) => Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn:'))));

    // 3. Test getIceServers({ relayUrl }) SDK integration
    const sdkServers = await getIceServers({ relayUrl: baseUrl });
    assert.ok(Array.isArray(sdkServers));
    assert.ok(sdkServers.some((s) => s.urls === 'stun:stun.l.google.com:19302'));

    // 4. Peer ID allocation (/copio/id)
    const idRes = await fetch(`${baseUrl}/copio/id`);
    assert.equal(idRes.status, 200);
    const peerId = await idRes.text();
    assert.ok(peerId.startsWith('peer_'));

    // 5. WebSocket signaling connection & message routing
    const wsUrl = `ws://localhost:${relay.port}`;
    const peer1Id = 'peer_host_1';
    const peer2Id = 'peer_sender_2';

    const ws1 = new WebSocket(`${wsUrl}/copio/${peer1Id}/token1/ws`);
    const ws2 = new WebSocket(`${wsUrl}/copio/${peer2Id}/token2/ws`);

    // Wait for OPEN messages on both sockets
    const openPromise1 = new Promise((resolve) => {
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'OPEN') resolve(msg);
      });
    });

    const openPromise2 = new Promise((resolve) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'OPEN') resolve(msg);
      });
    });

    await Promise.all([openPromise1, openPromise2]);

    // Send routed OFFER from peer2 to peer1
    const routedPromise = new Promise((resolve) => {
      ws1.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'OFFER') resolve(msg);
      });
    });

    ws2.send(
      JSON.stringify({
        type: 'OFFER',
        dst: peer1Id,
        payload: { sdp: 'fake-offer-sdp' },
      })
    );

    const receivedOffer = await routedPromise;
    assert.equal(receivedOffer.type, 'OFFER');
    assert.equal(receivedOffer.src, peer2Id);
    assert.equal(receivedOffer.payload.sdp, 'fake-offer-sdp');

    ws1.close();
    ws2.close();
  } finally {
    await relay.close();
  }
});
