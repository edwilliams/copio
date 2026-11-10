// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio WebRTC Handoff Transport via PeerJS (CPO-094 / ADR 0002)
 *
 * Implements the bi-directional transport interface for HandoffSession using PeerJS WebRTC
 * data channels with STUN/TURN ICE server configuration and auto-reconnection.
 */

import { loadPeerJs } from '../utils/module-loader.js';
import { getIceServers, parseRelayUrl } from './ice-servers.js';
import { LoopbackTransport } from './handoff-session.js';

export class HandoffPeerTransport {
  #role; // 'host' | 'sender'
  #peerId = null;
  #targetPeerId = null;
  #peer = null;
  #conn = null;
  #customIceServers = null;
  #relayUrl = null;
  #signalingUrl = null;
  #iceTransportPolicy = 'all'; // 'all' | 'relay'
  #lastConnectionInfo = null;
  #onMessageHandlers = new Set();
  #onCloseHandlers = new Set();
  #onOpenHandlers = new Set();
  #closed = false;
  #isDestroyed = false;
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectTimer = null;
  #pendingQueue = [];
  #loopback = null;
  #loopbackUnregister = null;

  /**
   * @param {Object} [options]
   * @param {'host'|'sender'} [options.role] - Local peer role
   * @param {string} [options.peerId] - Local peer ID (required for host)
   * @param {string} [options.targetPeerId] - Remote peer ID (required for sender)
   * @param {Array<RTCIceServer>} [options.iceServers]
   * @param {string} [options.relayUrl] - Base URL for Copio Relay signaling / TURN endpoint
   * @param {string} [options.signalingUrl] - URL for custom WebRTC signaling server
   * @param {'all'|'relay'} [options.iceTransportPolicy='all'] - ICE candidate transport policy
   * @param {any} [options.peerInstance] - Injected Peer instance (for tests)
   */
  constructor(options = {}) {
    if (!options.role || (options.role !== 'host' && options.role !== 'sender')) {
      throw new Error("HandoffPeerTransport requires role to be 'host' or 'sender'");
    }
    this.#role = options.role;
    this.#peerId = options.peerId || null;
    this.#targetPeerId = options.targetPeerId || null;
    this.#customIceServers = options.iceServers || null;
    this.#relayUrl = options.relayUrl || null;
    this.#signalingUrl = options.signalingUrl || null;
    this.#iceTransportPolicy = options.iceTransportPolicy || 'all';

    if (this.#role === 'sender' && !this.#targetPeerId) {
      throw new Error('Sender transport requires targetPeerId');
    }

    if (this.#role === 'host' && this.#peerId) {
      this.#setupLoopbackBridge();
    }

    if (options.peerInstance) {
      this.#peer = options.peerInstance;
      this.#bindPeerEvents(this.#peer);
    } else {
      this.#init().catch((err) => {
        console.warn('[HandoffPeerTransport] init error:', err);
      });
    }
  }

  get peerId() {
    return this.#peerId;
  }

  get targetPeerId() {
    return this.#targetPeerId;
  }

  get relayUrl() {
    return this.#relayUrl;
  }

  get signalingUrl() {
    return this.#signalingUrl;
  }

  get iceTransportPolicy() {
    return this.#iceTransportPolicy;
  }

  get connectionInfo() {
    return this.#lastConnectionInfo || {
      transport: this.#iceTransportPolicy === 'relay' ? 'turn' : 'direct',
      rttMs: 0,
    };
  }

  async #init() {
    if (this.#isDestroyed) return;

    try {
      let iceServers = this.#customIceServers;
      if (!iceServers || iceServers.length === 0) {
        iceServers = await getIceServers({ relayUrl: this.#relayUrl });
      }

      const Peer = await loadPeerJs();

      if (this.#isDestroyed) return;
      if (!Peer) {
        throw new Error('PeerJS is not available');
      }

      const config = { iceServers };
      if (this.#iceTransportPolicy) {
        config.iceTransportPolicy = this.#iceTransportPolicy;
      }

      const peerOptions = { config, debug: 0 };

      // Configure custom signaling server if signalingUrl or relayUrl is provided
      const sigUrl = this.#signalingUrl || this.#relayUrl;
      if (sigUrl) {
        const parsed = parseRelayUrl(sigUrl);
        if (parsed) {
          peerOptions.host = parsed.host;
          peerOptions.port = parsed.port;
          peerOptions.path = parsed.path;
          peerOptions.secure = parsed.secure;
        }
      }

      if (this.#role === 'host' && this.#peerId) {
        this.#peer = new Peer(this.#peerId, peerOptions);
      } else {
        this.#peer = new Peer(peerOptions);
      }

      this.#bindPeerEvents(this.#peer);
    } catch (err) {
      console.warn('[HandoffPeerTransport] init failed:', err);
      if (this.#role === 'sender' && !this.#closed) {
        this.#scheduleReconnect();
      }
    }
  }

  #setupLoopbackBridge() {
    if (this.#loopback || !this.#peerId) return;
    this.#loopback = new LoopbackTransport();
    this.#loopbackUnregister = LoopbackTransport.register(this.#peerId, this.#loopback);
    this.#loopback.onMessage((data) => {
      this.#deliver(data);
    });
  }

  #bindPeerEvents(peer) {
    peer.on('open', (id) => {
      this.#peerId = id;
      if (this.#role === 'host') {
        this.#setupLoopbackBridge();
      }
      if (this.#role === 'sender' && this.#targetPeerId) {
        this.#connectToHost();
      }
    });

    peer.on('connection', (conn) => {
      if (this.#role === 'host') {
        this.#attachConnection(conn);
      }
    });

    peer.on('error', (err) => {
      console.warn('[HandoffPeerTransport] peer error:', err);
      if (this.#role === 'sender' && !this.#closed) {
        this.#scheduleReconnect();
      }
    });

    peer.on('close', () => {
      this.#triggerClose();
    });
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
    if (this.#loopback) {
      try {
        this.#loopback.send(data);
      } catch {
        // loopback peer may not be connected
      }
    }
    if (this.#conn && this.#conn.open) {
      this.#conn.send(data);
    } else if (this.#role === 'sender' || (this.#conn && !this.#conn.open)) {
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

  /**
   * Retrieves connection diagnostics (telemetry-free).
   * @returns {Promise<{ transport: 'direct' | 'turn', rttMs: number }>}
   */
  async getConnectionInfo() {
    const forcedTurn = this.#iceTransportPolicy === 'relay';

    const pc = this.#conn?.peerConnection || this.#conn?._peerConnection;
    if (pc && typeof pc.getStats === 'function') {
      try {
        const stats = await pc.getStats();
        let selectedPair = null;

        for (const report of stats.values()) {
          if (report.type === 'transport' && report.selectedCandidatePairId) {
            selectedPair = stats.get(report.selectedCandidatePairId);
            break;
          }
        }

        if (!selectedPair) {
          for (const report of stats.values()) {
            if (
              report.type === 'candidate-pair' &&
              (report.selected || report.nominated || report.state === 'succeeded')
            ) {
              selectedPair = report;
              break;
            }
          }
        }

        if (selectedPair) {
          const localCandidate = stats.get(selectedPair.localCandidateId);
          const remoteCandidate = stats.get(selectedPair.remoteCandidateId);

          const isTurn =
            forcedTurn ||
            localCandidate?.candidateType === 'relay' ||
            remoteCandidate?.candidateType === 'relay';

          const rtt = selectedPair.currentRoundTripTime ?? selectedPair.roundTripTime ?? 0;
          const info = {
            transport: /** @type {'direct'|'turn'} */ (isTurn ? 'turn' : 'direct'),
            rttMs: Math.round(rtt * 1000),
          };
          this.#lastConnectionInfo = info;
          return info;
        }
      } catch (err) {
        console.warn('[HandoffPeerTransport] getStats error:', err);
      }
    }

    const fallback = {
      transport: /** @type {'direct'|'turn'} */ (forcedTurn ? 'turn' : 'direct'),
      rttMs: 0,
    };
    this.#lastConnectionInfo = fallback;
    return fallback;
  }

  close() {
    this.#closed = true;
    this.#isDestroyed = true;
    clearTimeout(this.#reconnectTimer);
    if (this.#loopbackUnregister) {
      this.#loopbackUnregister();
      this.#loopbackUnregister = null;
    }
    if (this.#loopback) {
      try {
        this.#loopback.close();
      } catch {
        // ignore
      }
      this.#loopback = null;
    }
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
