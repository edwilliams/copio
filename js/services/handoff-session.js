// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Headless Handoff Session (CPO-090 / ADR 0002)
 *
 * Ephemeral, single-session Phone-to-Desktop capture streaming session with
 * End-to-End Encryption (ECDH P-256 + AES-GCM-256), chunked binary streaming (64 KB),
 * progress tracking, and loopback transport support.
 */

import {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptPayload,
  decryptPayload,
  decryptJsonPayload,
  utf8ToBase64Url,
  base64UrlToUtf8,
} from './handoff-crypto.js';

export const HANDOFF_DEFAULT_CHUNK_SIZE = 64 * 1024; // 64 KB
export const HANDOFF_DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generates a random session or peer identifier.
 * @param {string} prefix
 * @returns {string}
 */
export function randomHandoffId(prefix = 'hnd_') {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return `${prefix}${hex}`;
}

/**
 * Serializes and encodes a session token for optical QR distribution.
 * @param {{ sessionId: string, peerId: string, pubKey: string, expiresAt: number, v?: number }} token
 * @returns {string} Base64URL-encoded token string
 */
export function encodeSessionToken(token) {
  const payload = {
    v: token.v || 1,
    sessionId: token.sessionId,
    peerId: token.peerId,
    pubKey: token.pubKey,
    expiresAt: token.expiresAt,
  };
  return utf8ToBase64Url(JSON.stringify(payload));
}

/**
 * Decodes and validates a session token string.
 * @param {string} tokenStr
 * @returns {{ v: number, sessionId: string, peerId: string, pubKey: string, expiresAt: number }}
 */
export function decodeSessionToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') {
    throw new Error('Invalid handoff token string');
  }
  let json;
  try {
    const trimmed = tokenStr.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      json = JSON.parse(trimmed);
    } else {
      json = JSON.parse(base64UrlToUtf8(tokenStr));
    }
  } catch (err) {
    throw new Error(`Failed to decode handoff token: ${err.message}`);
  }

  if (!json.sessionId || !json.peerId || !json.pubKey || !json.expiresAt) {
    throw new Error('Malformed handoff token: missing required fields');
  }

  if (Date.now() > json.expiresAt) {
    throw new Error(`Handoff session token has expired at ${new Date(json.expiresAt).toISOString()}`);
  }

  return json;
}

/**
 * Constructs a full handoff URL with the encoded token in the hash fragment.
 * @param {string} baseUrl
 * @param {Object} token
 * @returns {string}
 */
export function buildHandoffUrl(baseUrl, token) {
  const encoded = encodeSessionToken(token);
  const cleanBase = baseUrl ? baseUrl.split('#')[0] : '';
  return `${cleanBase}#handoff=${encoded}`;
}

/**
 * Extracts and decodes a handoff session token from a URL or hash string.
 * @param {string} urlOrHash
 * @returns {Object} Decoded session token
 */
export function parseHandoffUrl(urlOrHash) {
  if (!urlOrHash || typeof urlOrHash !== 'string') {
    throw new Error('Invalid URL or hash string for handoff');
  }
  const hashIndex = urlOrHash.indexOf('#');
  const hash = hashIndex !== -1 ? urlOrHash.slice(hashIndex + 1) : urlOrHash;

  // Support both "#handoff=..." and "#copio-handoff=..."
  const match = hash.match(/(?:copio-)?handoff=([^&]+)/);
  if (!match || !match[1]) {
    throw new Error('No handoff parameter found in hash');
  }

  return decodeSessionToken(match[1]);
}

/**
 * In-memory bi-directional transport for testing and local split-screen simulation.
 */
export class LoopbackTransport {
  #peer = null;
  #onMessageHandlers = new Set();
  #onCloseHandlers = new Set();
  #closed = false;
  #forceRelay = false;
  #iceTransportPolicy = 'all';

  static #registry = new Map();

  /**
   * Registers a transport endpoint under a peerId for automatic pairing.
   * @param {string} peerId
   * @param {LoopbackTransport} transport
   * @returns {Function} Unregister function
   */
  static register(peerId, transport) {
    LoopbackTransport.#registry.set(peerId, transport);
    return () => LoopbackTransport.#registry.delete(peerId);
  }

  /**
   * Checks if a peerId is registered in the loopback registry.
   * @param {string} peerId
   * @returns {boolean}
   */
  static has(peerId) {
    return LoopbackTransport.#registry.has(peerId);
  }

  /**
   * Gets a registered loopback transport.
   * @param {string} peerId
   * @returns {LoopbackTransport|undefined}
   */
  static get(peerId) {
    return LoopbackTransport.#registry.get(peerId);
  }

  /**
   * Clears all registered loopback transports.
   */
  static clearRegistry() {
    LoopbackTransport.#registry.clear();
  }

  /**
   * Creates a sender transport linked to a registered host peer.
   * @param {string} hostPeerId
   * @returns {LoopbackTransport}
   */
  static createLinkedSender(hostPeerId) {
    const hostTransport = LoopbackTransport.#registry.get(hostPeerId);
    if (!hostTransport) {
      throw new Error(`No registered loopback host for peerId: ${hostPeerId}`);
    }
    const senderTransport = new LoopbackTransport();
    hostTransport.#peer = senderTransport;
    senderTransport.#peer = hostTransport;
    hostTransport.#closed = false;
    senderTransport.#closed = false;
    return senderTransport;
  }

  /**
   * Creates a connected pair of loopback endpoints [endpointA, endpointB].
   * @returns {[LoopbackTransport, LoopbackTransport]}
   */
  static createPair() {
    const a = new LoopbackTransport();
    const b = new LoopbackTransport();
    a.#peer = b;
    b.#peer = a;
    return [a, b];
  }

  send(data) {
    if (this.#closed) {
      throw new Error('Cannot send on closed LoopbackTransport');
    }
    if (!this.#peer || this.#peer.#closed) {
      throw new Error('Remote peer disconnected');
    }
    const peer = this.#peer;
    // Dispatch asynchronously to emulate network tick
    queueMicrotask(() => {
      if (!peer.#closed) {
        peer.#deliver(data);
      }
    });
  }

  #deliver(data) {
    for (const handler of this.#onMessageHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error('[LoopbackTransport] message handler error:', err);
      }
    }
  }

  onMessage(handler) {
    this.#onMessageHandlers.add(handler);
    return () => this.#onMessageHandlers.delete(handler);
  }

  onClose(handler) {
    this.#onCloseHandlers.add(handler);
    return () => this.#onCloseHandlers.delete(handler);
  }

  /**
   * Simulates an interruption / connection drop without destroying the instance.
   */
  interrupt() {
    this.#closed = true;
    for (const handler of this.#onCloseHandlers) {
      try {
        handler();
      } catch (err) {
        console.error('[LoopbackTransport] close handler error:', err);
      }
    }
    if (this.#peer && !this.#peer.#closed) {
      this.#peer.interrupt();
    }
  }

  /**
   * Restores a closed or interrupted transport.
   * @param {LoopbackTransport} [newPeer]
   */
  reconnect(newPeer = null) {
    this.#closed = false;
    if (newPeer) {
      this.#peer = newPeer;
      newPeer.#peer = this;
      newPeer.#closed = false;
    } else if (this.#peer) {
      this.#peer.#closed = false;
    }
  }

  get forceRelay() {
    return this.#forceRelay;
  }

  set forceRelay(val) {
    this.#forceRelay = Boolean(val);
  }

  get iceTransportPolicy() {
    return this.#iceTransportPolicy;
  }

  set iceTransportPolicy(val) {
    this.#iceTransportPolicy = val;
  }

  /**
   * Returns loopback connection diagnostics.
   * Emulates TURN relay when forceRelay is true or iceTransportPolicy is 'relay'.
   * @returns {Promise<{ transport: 'direct'|'turn', rttMs: number }>}
   */
  async getConnectionInfo() {
    const isTurn = this.#forceRelay || this.#iceTransportPolicy === 'relay';
    return {
      transport: /** @type {'direct'|'turn'} */ (isTurn ? 'turn' : 'direct'),
      rttMs: isTurn ? 15 : 0,
    };
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    for (const handler of this.#onCloseHandlers) {
      try {
        handler();
      } catch (err) {
        console.error('[LoopbackTransport] close handler error:', err);
      }
    }
    if (this.#peer && !this.#peer.#closed) {
      const peer = this.#peer;
      this.#peer = null;
      peer.close();
    }
  }

  get isClosed() {
    return this.#closed;
  }
}

/**
 * Converts a Blob, ArrayBuffer, or Uint8Array into a Uint8Array.
 * @param {Blob|ArrayBuffer|Uint8Array} blobOrBytes
 * @returns {Promise<Uint8Array>}
 */
async function toUint8Array(blobOrBytes) {
  if (blobOrBytes instanceof Uint8Array) {
    return blobOrBytes;
  }
  if (blobOrBytes instanceof ArrayBuffer) {
    return new Uint8Array(blobOrBytes);
  }
  if (blobOrBytes && typeof blobOrBytes.arrayBuffer === 'function') {
    const buf = await blobOrBytes.arrayBuffer();
    return new Uint8Array(buf);
  }
  throw new TypeError('Payload must be a Uint8Array, ArrayBuffer, or Blob');
}

/**
 * Headless Phone-to-Desktop Handoff Session Manager.
 */
export class HandoffSession {
  #role; // 'host' | 'sender'
  #transport = null;
  #state = 'idle';
  #keyPair = null;
  #sharedKey = null;
  #sessionToken = null;
  #chunkSize;
  #ttlMs;
  #expiryTimer = null;
  #messageQueue = Promise.resolve();

  // Active page accumulation (Host)
  #incomingPages = new Map(); // pageId -> { info, chunks, receivedBytes }
  #receivedPages = [];

  // Listeners
  #listeners = {
    stateChange: new Set(),
    connectionInfo: new Set(),
    progress: new Set(),
    page: new Set(),
    complete: new Set(),
    error: new Set(),
  };

  /**
   * @param {Object} [options]
   * @param {'host'|'sender'} [options.role]
   * @param {Object} [options.transport]
   * @param {number} [options.chunkSize] - Chunk size in bytes (default 64 KB)
   * @param {number} [options.ttlMs] - Session TTL in ms (default 10 minutes)
   * @param {Function} [options.onStateChange]
   * @param {Function} [options.onProgress]
   * @param {Function} [options.onPage]
   * @param {Function} [options.onComplete]
   * @param {Function} [options.onError]
   */
  constructor(options = {}) {
    if (!options.role || (options.role !== 'host' && options.role !== 'sender')) {
      throw new Error("HandoffSession requires role to be 'host' or 'sender'");
    }
    this.#role = options.role;
    this.#chunkSize = options.chunkSize || HANDOFF_DEFAULT_CHUNK_SIZE;
    this.#ttlMs = options.ttlMs || HANDOFF_DEFAULT_TTL_MS;

    if (options.transport) {
      this.setTransport(options.transport);
    }
    if (options.onStateChange) this.on('stateChange', options.onStateChange);
    if (options.onProgress) this.on('progress', options.onProgress);
    if (options.onPage) this.on('page', options.onPage);
    if (options.onComplete) this.on('complete', options.onComplete);
    if (options.onError) this.on('error', options.onError);
  }

  get role() {
    return this.#role;
  }

  get state() {
    return this.#state;
  }

  get token() {
    return this.#sessionToken;
  }

  get isConnected() {
    return this.#state === 'connected' || this.#state === 'receiving' || this.#state === 'sending';
  }

  /**
   * Subscribes to session events.
   * @param {'stateChange'|'progress'|'page'|'complete'|'error'} event
   * @param {Function} fn
   * @returns {Function} Unsubscribe function
   */
  on(event, fn) {
    if (this.#listeners[event]) {
      this.#listeners[event].add(fn);
      return () => this.#listeners[event].delete(fn);
    }
    return () => {};
  }

  #emit(event, data) {
    if (this.#listeners[event]) {
      for (const fn of this.#listeners[event]) {
        try {
          fn(data);
        } catch (err) {
          console.error(`[HandoffSession] error in ${event} listener:`, err);
        }
      }
    }
  }

  #setState(newState) {
    if (this.#state === newState) return;
    this.#state = newState;
    this.#emit('stateChange', newState);
    if (newState === 'connected') {
      this.getConnectionInfo().then((info) => {
        this.#emit('connectionInfo', info);
      }).catch(() => {});
    }
  }

  #fail(error) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.#setState('error');
    this.#emit('error', err);
  }

  /**
   * Sets or attaches the underlying communication transport.
   * @param {Object} transport
   */
  setTransport(transport) {
    this.#transport = transport;
    transport.onMessage((data) => {
      this.#messageQueue = this.#messageQueue.then(async () => {
        await this.#handleMessage(data);
      }).catch((err) => {
        this.#fail(err);
      });
    });
    transport.onClose(() => {
      if (this.#state !== 'closed' && this.#state !== 'complete') {
        this.#setState('disconnected');
      }
    });
  }

  /**
   * Convenience factory to create a paired in-memory loopback session.
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {string} [options.peerId]
   * @param {number} [options.ttlMs]
   * @param {number} [options.chunkSize]
   * @returns {Promise<{ host: HandoffSession, sender: HandoffSession, token: Object, url: string }>}
   */
  static async createLoopbackPair(options = {}) {
    const [hostTransport, senderTransport] = LoopbackTransport.createPair();

    const host = new HandoffSession({
      role: 'host',
      transport: hostTransport,
      chunkSize: options.chunkSize,
      ttlMs: options.ttlMs,
    });

    const sender = new HandoffSession({
      role: 'sender',
      transport: senderTransport,
      chunkSize: options.chunkSize,
      ttlMs: options.ttlMs,
    });

    const { token, url } = await host.startHost({
      baseUrl: options.baseUrl || 'https://copio.netlify.app/scan',
      peerId: options.peerId || randomHandoffId('peer_'),
    });

    await sender.startSender(token);

    return { host, sender, token, url };
  }

  /**
   * Initializes host mode: generates ECDH keys, session token, and waits for sender.
   * @param {Object} [params]
   * @param {string} [params.baseUrl]
   * @param {string} [params.peerId]
   * @param {string} [params.relayUrl]
   * @param {string} [params.signalingUrl]
   * @param {Array<RTCIceServer>} [params.iceServers]
   * @returns {Promise<{ token: Object, url: string, rawToken: string }>}
   */
  async startHost(params = {}) {
    if (this.#role !== 'host') {
      throw new Error('startHost() can only be called on a host session');
    }

    this.#keyPair = await generateEcdhKeyPair();
    const pubKey = await exportPublicKey(this.#keyPair.publicKey);
    const sessionId = randomHandoffId('hnd_');
    const peerId = params.peerId || randomHandoffId('peer_');
    const expiresAt = Date.now() + this.#ttlMs;

    this.#sessionToken = {
      v: 1,
      sessionId,
      peerId,
      pubKey,
      expiresAt,
    };
    if (params.relayUrl) this.#sessionToken.relayUrl = params.relayUrl;
    if (params.signalingUrl) this.#sessionToken.signalingUrl = params.signalingUrl;
    if (params.iceServers) this.#sessionToken.iceServers = params.iceServers;

    const baseUrl = params.baseUrl || (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
    const url = buildHandoffUrl(baseUrl, this.#sessionToken);
    const rawToken = encodeSessionToken(this.#sessionToken);

    clearTimeout(this.#expiryTimer);
    this.#expiryTimer = setTimeout(() => {
      if (this.#state === 'waiting' || this.#state === 'idle') {
        this.#setState('expired');
      }
    }, this.#ttlMs);

    this.#setState('waiting');
    return { token: this.#sessionToken, url, rawToken };
  }

  /**
   * Initializes sender mode: connects to desktop host and initiates E2EE handshake.
   * @param {string|Object} tokenOrUrl
   * @returns {Promise<void>}
   */
  async startSender(tokenOrUrl) {
    if (this.#role !== 'sender') {
      throw new Error('startSender() can only be called on a sender session');
    }

    let token;
    if (typeof tokenOrUrl === 'string') {
      token = tokenOrUrl.includes('#') ? parseHandoffUrl(tokenOrUrl) : decodeSessionToken(tokenOrUrl);
    } else {
      token = tokenOrUrl;
    }

    if (!token || !token.sessionId || !token.pubKey) {
      throw new Error('Invalid handoff token');
    }
    if (Date.now() > token.expiresAt) {
      this.#setState('expired');
      throw new Error('Handoff session has expired');
    }

    this.#sessionToken = token;
    this.#setState('connecting');

    // Generate sender ECDH keypair
    this.#keyPair = await generateEcdhKeyPair();
    const senderPubKeyB64 = await exportPublicKey(this.#keyPair.publicKey);

    // Derive shared secret using host's public key from token
    const hostPubKey = await importPublicKey(token.pubKey);
    this.#sharedKey = await deriveSharedKey(this.#keyPair.privateKey, hostPubKey);

    if (!this.#transport) {
      throw new Error('Transport must be set before starting sender');
    }

    // Send unencrypted initial handshake message carrying sender's public key
    this.#transport.send({
      type: 'handshake_init',
      sessionId: token.sessionId,
      senderPubKey: senderPubKeyB64,
    });
  }

  /**
   * Reconnects sender session using a new or existing transport.
   * @param {Object} [newTransport]
   * @returns {Promise<void>}
   */
  async reconnect(newTransport = null) {
    if (this.#role !== 'sender') {
      throw new Error('reconnect() can only be called on a sender session');
    }
    if (!this.#sessionToken) {
      throw new Error('Cannot reconnect: no session token');
    }
    if (Date.now() > this.#sessionToken.expiresAt) {
      this.#setState('expired');
      throw new Error('Handoff session has expired');
    }

    if (newTransport) {
      this.setTransport(newTransport);
    } else if (this.#transport && typeof this.#transport.reconnect === 'function') {
      this.#transport.reconnect();
    }

    this.#setState('connecting');

    if (!this.#keyPair) {
      this.#keyPair = await generateEcdhKeyPair();
    }
    const senderPubKeyB64 = await exportPublicKey(this.#keyPair.publicKey);
    const hostPubKey = await importPublicKey(this.#sessionToken.pubKey);
    this.#sharedKey = await deriveSharedKey(this.#keyPair.privateKey, hostPubKey);

    if (!this.#transport || this.#transport.isClosed) {
      throw new Error('Cannot reconnect without active transport');
    }

    this.#transport.send({
      type: 'handshake_init',
      sessionId: this.#sessionToken.sessionId,
      senderPubKey: senderPubKeyB64,
    });
  }

  /**
   * Sends a captured page to the desktop host in encrypted 64 KB chunks.
   * @param {Object} page
   * @param {string} page.id
   * @param {number} [page.pageIndex]
   * @param {string} [page.mimeType]
   * @param {Blob|ArrayBuffer|Uint8Array} page.blob
   * @param {Object} [page.metadata]
   * @returns {Promise<void>}
   */
  async sendPage(page) {
    if (this.#role !== 'sender') {
      throw new Error('sendPage() can only be called by sender');
    }
    if (!this.isConnected || !this.#sharedKey) {
      throw new Error(`Cannot send page in state "${this.#state}" (not connected)`);
    }

    const pageId = page.id || randomHandoffId('page_');
    const pageIndex = typeof page.pageIndex === 'number' ? page.pageIndex : 0;
    const mimeType = page.mimeType || 'image/jpeg';
    const bytes = await toUint8Array(page.blob);
    const totalBytes = bytes.byteLength;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / this.#chunkSize));

    this.#setState('sending');

    // 1. Send encrypted PAGE_START
    const startPayload = {
      type: 'page_start',
      pageId,
      pageIndex,
      mimeType,
      totalBytes,
      totalChunks,
      metadata: page.metadata || {},
    };
    const startEncrypted = await encryptPayload(this.#sharedKey, startPayload);
    this.#transport.send({
      type: 'envelope',
      iv: startEncrypted.iv,
      ciphertext: startEncrypted.ciphertext,
    });

    // 2. Stream encrypted chunks
    let bytesSent = 0;
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.#chunkSize;
      const end = Math.min(start + this.#chunkSize, totalBytes);
      const slice = bytes.subarray(start, end);

      const chunkEncrypted = await encryptPayload(this.#sharedKey, slice);
      this.#transport.send({
        type: 'chunk_envelope',
        pageId,
        chunkIndex,
        totalChunks,
        iv: chunkEncrypted.iv,
        ciphertext: chunkEncrypted.ciphertext,
      });

      bytesSent += slice.length;
      const progress = {
        role: 'sender',
        pageId,
        pageIndex,
        chunkIndex,
        totalChunks,
        bytesSent,
        totalBytes,
        percent: Math.round((bytesSent / totalBytes) * 100),
      };
      this.#emit('progress', progress);
    }

    // 3. Send encrypted PAGE_END
    const endPayload = {
      type: 'page_end',
      pageId,
      totalBytes,
    };
    const endEncrypted = await encryptPayload(this.#sharedKey, endPayload);
    this.#transport.send({
      type: 'envelope',
      iv: endEncrypted.iv,
      ciphertext: endEncrypted.ciphertext,
    });

    this.#setState('connected');
  }

  /**
   * Completes the capture session and notifies the host.
   * @param {Object} [details]
   * @param {string} [details.docId]
   * @param {Object} [details.summary]
   * @returns {Promise<void>}
   */
  async complete(details = {}) {
    if (this.#role !== 'sender') {
      throw new Error('complete() can only be called by sender');
    }
    if (!this.#sharedKey) {
      throw new Error('Session is not authenticated');
    }

    const payload = {
      type: 'session_complete',
      docId: details.docId || randomHandoffId('doc_'),
      summary: details.summary || {},
      completedAt: Date.now(),
    };

    const enc = await encryptPayload(this.#sharedKey, payload);
    this.#transport.send({
      type: 'envelope',
      iv: enc.iv,
      ciphertext: enc.ciphertext,
    });

    this.#setState('complete');
    this.#emit('complete', payload);
  }

  /**
   * Internal message dispatcher.
   * @param {Object} msg
   */
  async #handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    try {
      if (this.#role === 'host') {
        await this.#handleHostMessage(msg);
      } else {
        await this.#handleSenderMessage(msg);
      }
    } catch (err) {
      this.#fail(err);
    }
  }

  async #handleHostMessage(msg) {
    // 1. Handshake initiation from sender
    if (msg.type === 'handshake_init') {
      if (!this.#sessionToken) {
        throw new Error('Host session not initialized');
      }
      if (msg.sessionId !== this.#sessionToken.sessionId) {
        throw new Error('Session ID mismatch in handshake');
      }
      if (Date.now() > this.#sessionToken.expiresAt) {
        this.#setState('expired');
        throw new Error('Handoff session token expired');
      }

      // Import sender's public key and derive shared secret
      const senderPubKey = await importPublicKey(msg.senderPubKey);
      this.#sharedKey = await deriveSharedKey(this.#keyPair.privateKey, senderPubKey);

      // Reply with encrypted handshake acknowledgment
      const ackEncrypted = await encryptPayload(this.#sharedKey, {
        type: 'handshake_ack',
        sessionId: this.#sessionToken.sessionId,
        status: 'ready',
      });

      this.#transport.send({
        type: 'envelope',
        iv: ackEncrypted.iv,
        ciphertext: ackEncrypted.ciphertext,
      });

      clearTimeout(this.#expiryTimer);
      this.#setState('connected');
      return;
    }

    // 2. Encrypted chunk envelope
    if (msg.type === 'chunk_envelope') {
      if (!this.#sharedKey) {
        throw new Error('Received chunk before handshake completion');
      }
      const pageInfo = this.#incomingPages.get(msg.pageId);
      if (!pageInfo) {
        throw new Error(`Received chunk for unknown page: ${msg.pageId}`);
      }

      const chunkBytes = await decryptPayload(this.#sharedKey, msg.iv, msg.ciphertext);
      pageInfo.chunks[msg.chunkIndex] = chunkBytes;
      pageInfo.receivedBytes += chunkBytes.length;

      const progress = {
        role: 'host',
        pageId: msg.pageId,
        pageIndex: pageInfo.start.pageIndex,
        chunkIndex: msg.chunkIndex,
        totalChunks: msg.totalChunks,
        bytesReceived: pageInfo.receivedBytes,
        totalBytes: pageInfo.start.totalBytes,
        percent: Math.round((pageInfo.receivedBytes / pageInfo.start.totalBytes) * 100),
      };
      this.#emit('progress', progress);
      return;
    }

    // 3. Encrypted general control envelope
    if (msg.type === 'envelope') {
      if (!this.#sharedKey) {
        throw new Error('Received envelope before handshake completion');
      }
      const payload = await decryptJsonPayload(this.#sharedKey, msg.iv, msg.ciphertext);

      if (payload.type === 'page_start') {
        this.#incomingPages.set(payload.pageId, {
          start: payload,
          chunks: Array.from({ length: payload.totalChunks }),
          receivedBytes: 0,
        });
        this.#setState('receiving');
        return;
      }

      if (payload.type === 'page_end') {
        const pageInfo = this.#incomingPages.get(payload.pageId);
        if (!pageInfo) {
          throw new Error(`Received page_end for unknown page: ${payload.pageId}`);
        }

        const mimeType = pageInfo.start.mimeType || 'image/jpeg';
        let blob;
        if (typeof globalThis.Blob === 'function') {
          blob = new globalThis.Blob(pageInfo.chunks, { type: mimeType });
        } else {
          // Flatten chunks into a single Uint8Array in environments without Blob
          const total = pageInfo.chunks.reduce((acc, c) => acc + c.length, 0);
          const combined = new Uint8Array(total);
          let offset = 0;
          for (const c of pageInfo.chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          blob = combined;
        }

        const pageResult = {
          id: payload.pageId,
          pageIndex: pageInfo.start.pageIndex,
          mimeType,
          blob,
          metadata: pageInfo.start.metadata,
        };

        this.#receivedPages.push(pageResult);
        this.#incomingPages.delete(payload.pageId);
        this.#emit('page', pageResult);
        this.#setState('connected');
        return;
      }

      if (payload.type === 'session_complete') {
        const result = {
          docId: payload.docId,
          pageCount: this.#receivedPages.length,
          pages: [...this.#receivedPages],
          summary: payload.summary,
        };
        this.#setState('complete');
        this.#emit('complete', result);
        return;
      }
    }
  }

  async #handleSenderMessage(msg) {
    if (msg.type === 'envelope') {
      if (!this.#sharedKey) {
        throw new Error('Received envelope without shared key');
      }
      const payload = await decryptJsonPayload(this.#sharedKey, msg.iv, msg.ciphertext);
      if (payload.type === 'handshake_ack') {
        this.#setState('connected');
      }
    }
  }

  /**
   * Retrieves connection diagnostics from the underlying transport.
   * @returns {Promise<{ transport: 'direct'|'turn', rttMs: number }>}
   */
  async getConnectionInfo() {
    if (this.#transport && typeof this.#transport.getConnectionInfo === 'function') {
      return await this.#transport.getConnectionInfo();
    }
    return { transport: 'direct', rttMs: 0 };
  }

  /**
   * Closes the session and tears down transport and cryptographic state.
   */
  close() {
    clearTimeout(this.#expiryTimer);
    if (this.#transport) {
      try {
        this.#transport.close();
      } catch {
        // ignore
      }
      this.#transport = null;
    }
    this.#keyPair = null;
    this.#sharedKey = null;
    this.#incomingPages.clear();
    this.#receivedPages = [];
    this.#setState('closed');
  }
}
