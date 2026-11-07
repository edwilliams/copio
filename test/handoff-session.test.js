// SPDX-License-Identifier: AGPL-3.0
import { expect } from '@esm-bundle/chai';
import {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptPayload,
  decryptPayload,
  decryptJsonPayload,
  bytesToBase64Url,
  base64UrlToBytes,
} from '../js/services/handoff-crypto.js';
import {
  HandoffSession,
  LoopbackTransport,
  encodeSessionToken,
  decodeSessionToken,
  buildHandoffUrl,
  parseHandoffUrl,
} from '../js/services/handoff-session.js';

describe('Handoff Cryptographic Primitives (CPO-090)', () => {
  it('encodes and decodes binary buffers using Base64URL cleanly', () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < original.length; i++) {
      original[i] = i;
    }
    const b64url = bytesToBase64Url(original);
    expect(b64url).to.be.a('string');
    expect(b64url).to.not.include('+');
    expect(b64url).to.not.include('/');
    expect(b64url).to.not.include('=');

    const restored = base64UrlToBytes(b64url);
    expect(restored.length).to.equal(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).to.equal(original[i]);
    }
  });

  it('generates, exports, imports ECDH P-256 keys and derives matching AES-GCM-256 keys', async () => {
    const keyPairA = await generateEcdhKeyPair();
    const keyPairB = await generateEcdhKeyPair();

    const pubKeyStrA = await exportPublicKey(keyPairA.publicKey);
    const pubKeyStrB = await exportPublicKey(keyPairB.publicKey);

    expect(pubKeyStrA).to.be.a('string');
    expect(pubKeyStrB).to.be.a('string');

    const importedPubA = await importPublicKey(pubKeyStrA);
    const importedPubB = await importPublicKey(pubKeyStrB);

    const derivedA = await deriveSharedKey(keyPairA.privateKey, importedPubB);
    const derivedB = await deriveSharedKey(keyPairB.privateKey, importedPubA);

    // Encrypt with Key A, decrypt with Key B
    const secretMessage = 'Copio E2EE Phone Handoff Secret 12345';
    const encrypted = await encryptPayload(derivedA, secretMessage);
    expect(encrypted.iv).to.be.a('string');
    expect(encrypted.ciphertext).to.be.a('string');

    const decryptedBytes = await decryptPayload(derivedB, encrypted.iv, encrypted.ciphertext);
    const decryptedText = new TextDecoder().decode(decryptedBytes);
    expect(decryptedText).to.equal(secretMessage);

    const decryptedJson = await decryptJsonPayload(derivedB, encrypted.iv, encrypted.ciphertext);
    expect(decryptedJson).to.equal(secretMessage);
  });

  it('detects tampering and rejects corrupted ciphertext with AES-GCM AEAD tag failure', async () => {
    const kpA = await generateEcdhKeyPair();
    const kpB = await generateEcdhKeyPair();
    const derived = await deriveSharedKey(kpA.privateKey, kpB.publicKey);

    const encrypted = await encryptPayload(derived, 'Sensitive patient record or passport scan');
    const cipherBytes = base64UrlToBytes(encrypted.ciphertext);

    // Tamper with one byte
    cipherBytes[0] ^= 0xff;
    const tamperedCipher = bytesToBase64Url(cipherBytes);

    let failed = false;
    try {
      await decryptPayload(derived, encrypted.iv, tamperedCipher);
    } catch {
      failed = true;
    }
    expect(failed).to.be.true;
  });
});

describe('Handoff Session Tokens & URL Parsing (CPO-090)', () => {
  it('creates, encodes, and decodes session tokens within TTL', () => {
    const tokenData = {
      v: 1,
      sessionId: 'hnd_abc123',
      peerId: 'peer_xyz789',
      pubKey: 'pubkey_sample_token',
      expiresAt: Date.now() + 600000,
    };

    const encoded = encodeSessionToken(tokenData);
    expect(encoded).to.be.a('string');

    const decoded = decodeSessionToken(encoded);
    expect(decoded.sessionId).to.equal(tokenData.sessionId);
    expect(decoded.peerId).to.equal(tokenData.peerId);
    expect(decoded.pubKey).to.equal(tokenData.pubKey);
    expect(decoded.expiresAt).to.equal(tokenData.expiresAt);
  });

  it('rejects expired session tokens', () => {
    const expiredToken = {
      v: 1,
      sessionId: 'hnd_old',
      peerId: 'peer_old',
      pubKey: 'pub_old',
      expiresAt: Date.now() - 5000, // expired 5 seconds ago
    };
    const encoded = encodeSessionToken(expiredToken);

    expect(() => decodeSessionToken(encoded)).to.throw(/expired/i);
  });

  it('builds and parses handoff URLs with hash fragments', () => {
    const tokenData = {
      sessionId: 'hnd_test_url',
      peerId: 'peer_test',
      pubKey: 'pub_test',
      expiresAt: Date.now() + 300000,
    };

    const url = buildHandoffUrl('https://example.com/app', tokenData);
    expect(url).to.include('https://example.com/app#handoff=');

    const parsed = parseHandoffUrl(url);
    expect(parsed.sessionId).to.equal(tokenData.sessionId);
    expect(parsed.peerId).to.equal(tokenData.peerId);

    // Also support hash without domain or with copio-handoff=
    const hashOnly = `#copio-handoff=${encodeSessionToken(tokenData)}`;
    const parsedHash = parseHandoffUrl(hashOnly);
    expect(parsedHash.sessionId).to.equal(tokenData.sessionId);
  });
});

describe('Headless HandoffSession Loopback Streaming Spike (CPO-090)', function () {
  this.timeout(10000);

  it('establishes E2EE connection, streams multi-page payload with 64KB chunks and progress, and completes session', async () => {
    // 1. Setup loopback pair
    const chunkSize = 32 * 1024; // Test with 32 KB chunk size to ensure multi-chunk streaming
    const { host, sender, token, url } = await HandoffSession.createLoopbackPair({
      chunkSize,
      baseUrl: 'https://copio.netlify.app/scan',
    });

    expect(token).to.exist;
    expect(token.sessionId).to.be.a('string');
    expect(parseHandoffUrl(url).sessionId).to.equal(token.sessionId);

    // Wait for connection to transition to 'connected'
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      const check = () => {
        if (host.isConnected && sender.isConnected) {
          clearTimeout(timeout);
          resolve();
        }
      };
      host.on('stateChange', check);
      sender.on('stateChange', check);
      check();
    });

    expect(host.state).to.equal('connected');
    expect(sender.state).to.equal('connected');

    // Track progress events
    const senderProgressEvents = [];
    const hostProgressEvents = [];
    const receivedPages = [];
    let completedPayload = null;

    sender.on('progress', (p) => senderProgressEvents.push(p));
    host.on('progress', (p) => hostProgressEvents.push(p));
    host.on('page', (p) => receivedPages.push(p));
    host.on('complete', (c) => {
      completedPayload = c;
    });

    // 2. Prepare mock multi-page images
    // Page 1: 100 KB payload (will split into 4 chunks at 32KB each)
    const page1Bytes = new Uint8Array(100 * 1024);
    for (let i = 0; i < page1Bytes.length; i++) {
      page1Bytes[i] = (i * 7) % 256;
    }

    // Page 2: 70 KB payload (will split into 3 chunks at 32KB each)
    const page2Bytes = new Uint8Array(70 * 1024);
    for (let i = 0; i < page2Bytes.length; i++) {
      page2Bytes[i] = (i * 13) % 256;
    }

    // 3. Stream Page 1
    await sender.sendPage({
      id: 'page_receipt_01',
      pageIndex: 0,
      mimeType: 'image/jpeg',
      blob: page1Bytes,
      metadata: { width: 1200, height: 1600, label: 'Receipt Front' },
    });

    // Wait for host to assemble page 1
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (receivedPages.length >= 1) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    expect(receivedPages.length).to.equal(1);
    expect(receivedPages[0].id).to.equal('page_receipt_01');
    expect(receivedPages[0].pageIndex).to.equal(0);
    expect(receivedPages[0].metadata.label).to.equal('Receipt Front');

    // Verify page 1 byte integrity
    const rec1Buf = await receivedPages[0].blob.arrayBuffer();
    const rec1Bytes = new Uint8Array(rec1Buf);
    expect(rec1Bytes.length).to.equal(page1Bytes.length);
    for (let i = 0; i < page1Bytes.length; i++) {
      if (page1Bytes[i] !== rec1Bytes[i]) {
        throw new Error(`Byte mismatch at index ${i}`);
      }
    }

    // 4. Stream Page 2
    await sender.sendPage({
      id: 'page_receipt_02',
      pageIndex: 1,
      mimeType: 'image/png',
      blob: page2Bytes,
      metadata: { width: 1200, height: 800, label: 'Receipt Back' },
    });

    // Wait for host to assemble page 2
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (receivedPages.length >= 2) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    expect(receivedPages.length).to.equal(2);
    expect(receivedPages[1].id).to.equal('page_receipt_02');
    expect(receivedPages[1].pageIndex).to.equal(1);

    // Verify page 2 byte integrity
    const rec2Buf = await receivedPages[1].blob.arrayBuffer();
    const rec2Bytes = new Uint8Array(rec2Buf);
    expect(rec2Bytes.length).to.equal(page2Bytes.length);
    for (let i = 0; i < page2Bytes.length; i++) {
      if (page2Bytes[i] !== rec2Bytes[i]) {
        throw new Error(`Byte mismatch at index ${i}`);
      }
    }

    // 5. Verify chunk progress callbacks
    expect(senderProgressEvents.length).to.be.at.least(7); // 4 chunks page1 + 3 chunks page2
    expect(hostProgressEvents.length).to.be.at.least(7);

    const lastSenderProgress = senderProgressEvents[senderProgressEvents.length - 1];
    expect(lastSenderProgress.percent).to.equal(100);
    expect(lastSenderProgress.bytesSent).to.equal(page2Bytes.length);

    const lastHostProgress = hostProgressEvents[hostProgressEvents.length - 1];
    expect(lastHostProgress.percent).to.equal(100);
    expect(lastHostProgress.bytesReceived).to.equal(page2Bytes.length);

    // 6. Complete Session
    await sender.complete({
      docId: 'doc_expense_99',
      summary: { totalPages: 2, note: 'Scan completed successfully' },
    });

    // Wait for completion event on host
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (completedPayload) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    expect(completedPayload).to.exist;
    expect(completedPayload.docId).to.equal('doc_expense_99');
    expect(completedPayload.pageCount).to.equal(2);
    expect(completedPayload.pages.length).to.equal(2);
    expect(host.state).to.equal('complete');
    expect(sender.state).to.equal('complete');

    // 7. Cleanup
    host.close();
    sender.close();
    expect(host.state).to.equal('closed');
    expect(sender.state).to.equal('closed');
  });

  it('rejects handshake if session ID does not match host token', async () => {
    const [hostTransport, senderTransport] = LoopbackTransport.createPair();
    const host = new HandoffSession({ role: 'host', transport: hostTransport });
    const sender = new HandoffSession({ role: 'sender', transport: senderTransport });

    const { token } = await host.startHost({ peerId: 'host_peer' });

    // Tamper with session ID in sender token
    const tamperedToken = { ...token, sessionId: 'hnd_attacker_spoofed' };

    let hostError = null;
    host.on('error', (err) => {
      hostError = err;
    });

    await sender.startSender(tamperedToken);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(hostError).to.exist;
    expect(hostError.message).to.match(/mismatch/i);
    expect(host.isConnected).to.be.false;

    host.close();
    sender.close();
  });
});
