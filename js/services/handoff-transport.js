// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio WebRTC Handoff Transport via PeerJS (CPO-094 / ADR 0002)
 *
 * Implements the bi-directional transport interface for HandoffSession using PeerJS WebRTC
 * data channels with STUN/TURN ICE server configuration and auto-reconnection.
 */

import { loadPeerJs } from '../utils/module-loader.js';
import { getIceServers } from './ice-servers.js';

export class HandoffPeerTransport {
  #role; // 'host' | 'sender'
  #peerId = null;
  #targetPeerId = null;
  #peer = null;
  #conn = null;
  #onMessageHandlers = new Set();
  #onCloseHandlers = new Set();
  #onOpenHandlers = new Set();
  #closed = false;
  #isDestroyed = false;
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectTimer = null;
  #pendingQueue = [];

  /**
   * @param {Object} [options]
   * @param {'host'|'sender'} [options.role] - Local peer role
   * @param {string} [options.peerId] - Local peer ID (required for host)
   * @param {string} [options.targetPeerId] - Remote peer ID (required for sender)
   * @param {Array<RTCIceServer>} [options.iceServers]
   */
  constructor(options = {}) {
    if (!options.role || (options.role !== 'host' && options.role !== 'sender')) {
      throw new Error("HandoffPeerTransport requires role to be 'host' or 'sender'");
    }
    this.#role = options.role;
    this.#peerId = options.peerId || null;
    this.#targetPeerId = options.targetPeerId || null;

    if (this.#role === 'sender' && !this.#targetPeerId) {
      throw new Error('Sender transport requires targetPeerId');
    }

    this.#init(options.iceServers).catch((err) => {
      console.warn('[HandoffPeerTransport] init error:', err);
    });
  }

  async #init(customIceServers = null) {
    if (this.#isDestroyed) return;

    try {
      const [iceServers, Peer] = await Promise.all([
        customIceServers ? Promise.resolve(customIceServers) : getIceServers(),
        loadPeerJs(),
      ]);

      if (this.#isDestroyed) return;
      if (!Peer) {
        throw new Error('PeerJS is not available');
      }

      const config = { iceServers };
      const peerOptions = { config, debug: 0 };

      if (this.#role === 'host' && this.#peerId) {
        this.#peer = new Peer(this.#peerId, peerOptions);
      } else {
        this.#peer = new Peer(peerOptions);
      }

      this.#peer.on('open', (id) => {
        this.#peerId = id;
        if (this.#role === 'sender' && this.#targetPeerId) {
          this.#connectToHost();
        }
      });

      this.#peer.on('connection', (conn) => {
        if (this.#role === 'host') {
          this.#attachConnection(conn);
        }
      });

      this.#peer.on('error', (err) => {
        console.warn('[HandoffPeerTransport] peer error:', err);
        if (this.#role === 'sender' && !this.#closed) {
          this.#scheduleReconnect();
        }
      });

      this.#peer.on('close', () => {
        this.#triggerClose();
      });
    } catch (err) {
      console.warn('[HandoffPeerTransport] init failed:', err);
      if (this.#role === 'sender' && !this.#closed) {
        this.#scheduleReconnect();
      }
    }
  }

  #connectToHost() {
    if (!this.#peer || this.#peer.destroyed || !this.#targetPeerId) return;

    const conn = this.#peer.connect(this.#targetPeerId, { reliable: true });
    this.#attachConnection(conn);
  }

  #attachConnection(conn) {
    this.#conn = conn;

    conn.on('open', () => {
      this.#closed = false;
      this.#reconnectAttempts = 0;
      clearTimeout(this.#reconnectTimer);

      for (const handler of this.#onOpenHandlers) {
        try {
          handler();
        } catch (err) {
          console.error('[HandoffPeerTransport] open handler error:', err);
        }
      }

      // Flush queued messages
      while (this.#pendingQueue.length > 0) {
        const item = this.#pendingQueue.shift();
        try {
          conn.send(item);
        } catch (err) {
          console.error('[HandoffPeerTransport] send queued message error:', err);
        }
      }
    });

    conn.on('data', (data) => {
      this.#deliver(data);
    });

    conn.on('close', () => {
      if (!this.#closed) {
        this.#triggerClose();
        if (this.#role === 'sender') {
          this.#scheduleReconnect();
        }
      }
    });

    conn.on('error', (err) => {
      console.warn('[HandoffPeerTransport] conn error:', err);
      if (!this.#closed) {
        this.#triggerClose();
        if (this.#role === 'sender') {
          this.#scheduleReconnect();
        }
      }
    });
  }

  #scheduleReconnect() {
    if (this.#isDestroyed || this.#closed) return;
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      console.warn('[HandoffPeerTransport] max reconnect attempts reached');
      return;
    }

    clearTimeout(this.#reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts), 8000);
    this.#reconnectAttempts++;

    this.#reconnectTimer = setTimeout(() => {
      if (!this.#isDestroyed && !this.#closed) {
        this.reconnect();
      }
    }, delay);
  }

  reconnect() {
    if (this.#isDestroyed) return;
    if (this.#conn) {
      try {
        this.#conn.close();
      } catch {
        // ignore
      }
      this.#conn = null;
    }

    if (this.#peer && !this.#peer.destroyed && this.#peer.open) {
      this.#connectToHost();
    } else {
      this.#init().catch(() => {});
    }
  }

  send(data) {
    if (this.#isDestroyed) {
      throw new Error('Cannot send on destroyed HandoffPeerTransport');
    }
    if (this.#conn && this.#conn.open) {
      this.#conn.send(data);
    } else {
      // Queue until open
      this.#pendingQueue.push(data);
    }
  }

  #deliver(data) {
    for (const handler of this.#onMessageHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error('[HandoffPeerTransport] message handler error:', err);
      }
    }
  }

  #triggerClose() {
    for (const handler of this.#onCloseHandlers) {
      try {
        handler();
      } catch (err) {
        console.error('[HandoffPeerTransport] close handler error:', err);
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

  onOpen(handler) {
    this.#onOpenHandlers.add(handler);
    if (this.#conn && this.#conn.open) {
      try {
        handler();
      } catch (err) {
        console.error('[HandoffPeerTransport] open handler error:', err);
      }
    }
    return () => this.#onOpenHandlers.delete(handler);
  }

  close() {
    this.#closed = true;
    this.#isDestroyed = true;
    clearTimeout(this.#reconnectTimer);
    if (this.#conn) {
      try {
        this.#conn.close();
      } catch {
        // ignore
      }
      this.#conn = null;
    }
    if (this.#peer && !this.#peer.destroyed) {
      try {
        this.#peer.destroy();
      } catch {
        // ignore
      }
      this.#peer = null;
    }
    this.#triggerClose();
  }

  get isClosed() {
    return this.#closed || this.#isDestroyed;
  }
}
