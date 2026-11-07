// SPDX-License-Identifier: AGPL-3.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptPayload,
  decryptJsonPayload,
  bytesToBase64Url,
  base64UrlToBytes,
} from '../js/services/handoff-crypto.js';
import {
  HandoffSession,
  randomHandoffId,
  encodeSessionToken,
  decodeSessionToken,
  buildHandoffUrl,
  parseHandoffUrl,
} from '../js/services/handoff-session.js';

test('handoff crypto: Base64URL roundtrip and zero DOM requirement', () => {
  assert.strictEqual(typeof window, 'undefined');
  assert.strictEqual(typeof document, 'undefined');

  const buf = new Uint8Array([1, 2, 3, 250, 251, 252, 255]);
  const b64url = bytesToBase64Url(buf);
  assert.strictEqual(typeof b64url, 'string');
  assert.ok(!b64url.includes('+'));
  assert.ok(!b64url.includes('/'));

  const restored = base64UrlToBytes(b64url);
  assert.deepStrictEqual(Array.from(restored), Array.from(buf));
});

test('handoff crypto: ECDH key agreement and AES-GCM payload encryption in Node', async () => {
  const kpA = await generateEcdhKeyPair();
  const kpB = await generateEcdhKeyPair();

  const pubA = await exportPublicKey(kpA.publicKey);
  const pubB = await exportPublicKey(kpB.publicKey);

  const impA = await importPublicKey(pubA);
  const impB = await importPublicKey(pubB);

  const sharedA = await deriveSharedKey(kpA.privateKey, impB);
  const sharedB = await deriveSharedKey(kpB.privateKey, impA);

  const payload = { secretScan: 'KYC Passport Scan Data', pageCount: 1 };
  const encrypted = await encryptPayload(sharedA, payload);

  const decrypted = await decryptJsonPayload(sharedB, encrypted.iv, encrypted.ciphertext);
  assert.deepStrictEqual(decrypted, payload);
});

test('handoff token: creation, serialization, expiration, and URL parsing', () => {
  const token = {
    v: 1,
    sessionId: randomHandoffId('hnd_'),
    peerId: 'peer_node_test',
    pubKey: 'sample_pubkey_bytes',
    expiresAt: Date.now() + 600000,
  };

  const url = buildHandoffUrl('https://app.example.com/scan', token);
  assert.ok(url.startsWith('https://app.example.com/scan#handoff='));

  const parsed = parseHandoffUrl(url);
  assert.strictEqual(parsed.sessionId, token.sessionId);
  assert.strictEqual(parsed.peerId, token.peerId);

  // Expired token throws
  const expiredToken = { ...token, expiresAt: Date.now() - 1000 };
  const expiredEncoded = encodeSessionToken(expiredToken);
  assert.throws(() => decodeSessionToken(expiredEncoded), /expired/);
});

test('HandoffSession loopback streaming: streams multi-page payload with 64KB chunks and progress callbacks', async () => {
  const chunkSize = 32 * 1024;
  const { host, sender, token, url } = await HandoffSession.createLoopbackPair({
    chunkSize,
    baseUrl: 'https://copio.netlify.app/scan',
  });

  assert.ok(token);
  assert.ok(url);

  // Wait for pairing
  await new Promise((resolve) => {
    const check = () => {
      if (host.isConnected && sender.isConnected) resolve();
    };
    host.on('stateChange', check);
    sender.on('stateChange', check);
    check();
  });

  assert.strictEqual(host.state, 'connected');
  assert.strictEqual(sender.state, 'connected');

  const senderProgress = [];
  const hostProgress = [];
  const receivedPages = [];
  let completeResult = null;

  sender.on('progress', (p) => senderProgress.push(p));
  host.on('progress', (p) => hostProgress.push(p));
  host.on('page', (p) => receivedPages.push(p));
  host.on('complete', (c) => {
    completeResult = c;
  });

  // Mock multi-page data (100 KB and 70 KB)
  const page1 = new Uint8Array(100 * 1024);
  for (let i = 0; i < page1.length; i++) page1[i] = (i * 3) % 256;

  const page2 = new Uint8Array(70 * 1024);
  for (let i = 0; i < page2.length; i++) page2[i] = (i * 5) % 256;

  // Stream page 1
  await sender.sendPage({
    id: 'p1',
    pageIndex: 0,
    mimeType: 'image/jpeg',
    blob: page1,
    metadata: { label: 'Front of Document' },
  });

  // Stream page 2
  await sender.sendPage({
    id: 'p2',
    pageIndex: 1,
    mimeType: 'image/jpeg',
    blob: page2,
    metadata: { label: 'Back of Document' },
  });

  // Wait for pages to be received on host
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (receivedPages.length >= 2) {
        clearInterval(interval);
        resolve();
      }
    }, 20);
  });

  assert.strictEqual(receivedPages.length, 2);
  assert.strictEqual(receivedPages[0].id, 'p1');
  assert.strictEqual(receivedPages[1].id, 'p2');

  const rec1Buf = await receivedPages[0].blob.arrayBuffer();
  assert.strictEqual(rec1Buf.byteLength, page1.length);
  const rec1Bytes = new Uint8Array(rec1Buf);
  assert.deepStrictEqual(Array.from(rec1Bytes.slice(0, 50)), Array.from(page1.slice(0, 50)));

  // Progress events occurred on both sender and host
  assert.ok(senderProgress.length >= 6);
  assert.ok(hostProgress.length >= 6);
  assert.strictEqual(senderProgress[senderProgress.length - 1].percent, 100);
  assert.strictEqual(hostProgress[hostProgress.length - 1].percent, 100);

  // Complete session
  await sender.complete({
    docId: 'doc_node_test',
    summary: { status: 'ok' },
  });

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (completeResult) {
        clearInterval(interval);
        resolve();
      }
    }, 20);
  });

  assert.ok(completeResult);
  assert.strictEqual(completeResult.docId, 'doc_node_test');
  assert.strictEqual(completeResult.pageCount, 2);
  assert.strictEqual(host.state, 'complete');
  assert.strictEqual(sender.state, 'complete');

  host.close();
  sender.close();
  assert.strictEqual(host.state, 'closed');
  assert.strictEqual(sender.state, 'closed');
});
