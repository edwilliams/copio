// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Phone-to-Desktop Handoff Web Component (<copio-handoff>) (CPO-091 / ADR 0002)
 *
 * Encapsulated Shadow DOM widget providing optical QR handoff, live streaming progress,
 * and local file upload fallback.
 */

import { COPIO_EVENTS, dispatchCopioEvent } from './events.js';
import { loadQrCode } from '../js/utils/module-loader.js';
import {
  HandoffSession,
  LoopbackTransport,
  randomHandoffId,
  encodeSessionToken,
  decodeSessionToken,
  buildHandoffUrl,
  parseHandoffUrl,
  HANDOFF_DEFAULT_CHUNK_SIZE,
  HANDOFF_DEFAULT_TTL_MS,
} from '../js/services/handoff-session.js';
import {
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptPayload,
  decryptPayload,
} from '../js/services/handoff-crypto.js';
import { handoffCss, getHandoffStyleSheet, adoptHandoffStyles } from './handoff-styles.js';

/** @type {typeof HTMLElement} */
const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : /** @type {any} */ (class {});

/**
 * Generates an SVG QR code from a target URL string.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function generateQrSvg(url) {
  try {
    const qrcode = await loadQrCode();
    if (qrcode) {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ scalable: true, margin: 4 });
    }
  } catch (err) {
    console.warn('[CopioHandoff] loadQrCode failed, using SVG fallback:', err);
  }

  // Pure SVG fallback if qrcode script is unavailable
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect width="100" height="100" fill="#ffffff" />
    <rect x="8" y="8" width="28" height="28" fill="#0b0f17" rx="3" />
    <rect x="13" y="13" width="18" height="18" fill="#ffffff" rx="2" />
    <rect x="17" y="17" width="10" height="10" fill="#0b0f17" rx="1" />
    <rect x="64" y="8" width="28" height="28" fill="#0b0f17" rx="3" />
    <rect x="69" y="13" width="18" height="18" fill="#ffffff" rx="2" />
    <rect x="73" y="17" width="10" height="10" fill="#0b0f17" rx="1" />
    <rect x="8" y="64" width="28" height="28" fill="#0b0f17" rx="3" />
    <rect x="13" y="69" width="18" height="18" fill="#ffffff" rx="2" />
    <rect x="17" y="73" width="10" height="10" fill="#0b0f17" rx="1" />
    <rect x="42" y="12" width="6" height="6" fill="#0284c7" />
    <rect x="52" y="20" width="6" height="6" fill="#0284c7" />
    <rect x="42" y="42" width="16" height="16" fill="#0284c7" rx="2" />
    <rect x="68" y="48" width="6" height="6" fill="#0b0f17" />
    <rect x="78" y="58" width="6" height="6" fill="#0b0f17" />
    <rect x="48" y="68" width="6" height="6" fill="#0b0f17" />
    <rect x="64" y="74" width="12" height="6" fill="#0b0f17" />
  </svg>`;
}

export class CopioHandoff extends BaseElement {
  #session = null;
  #state = 'waiting'; // 'waiting' | 'connected' | 'receiving' | 'complete' | 'error' | 'expired'
  #token = null;
  #url = '';
  #qrSvg = null;
  #pages = [];
  #activeProgress = null;
  #errorMessage = '';
  #remainingSeconds = 600;
  #countdownInterval = null;
  #sessionDocId = null;
  #unsubs = [];
  #autoStart = true;
  #relayUrl = '';
  #signalingUrl = '';
  #iceServers = null;
  #iceTransportPolicy = 'all';
  #customTransport = null;
  #connectionInfo = null;

  static get observedAttributes() {
    return [
      'state',
      'receiver-url',
      'doc-id',
      'theme',
      'ttl',
      'mode',
      'aspect',
      'relay-url',
      'ice-servers',
      'signaling-url',
      'ice-transport-policy',
      'transport',
    ];
  }

  constructor() {
    super();
    if (typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
    }
  }

  get #targetDocId() {
    if (this.docId) return this.docId;
    if (!this.#sessionDocId) {
      this.#sessionDocId = randomHandoffId('doc_');
    }
    return this.#sessionDocId;
  }

  connectedCallback() {
    if (this.shadowRoot) {
      adoptHandoffStyles(this.shadowRoot);
      this.#render();
    }

    if (this.#autoStart && !this.#session) {
      this.start().catch((err) => {
        this.#fail(err);
      });
    }
  }

  disconnectedCallback() {
    this.#stopCountdown();
    this.#cleanupSession();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'state' && newVal && newVal !== this.#state) {
      this.#state = newVal;
      this.#render();
    } else if (name === 'theme' && this.shadowRoot) {
      this.#render();
    }
  }

  // --- Properties ---

  get state() {
    return this.#state;
  }

  set state(val) {
    if (this.#state === val) return;
    this.#state = val;
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('state', val);
    }
    this.#render();
  }

  get session() {
    return this.#session;
  }

  set session(sess) {
    if (sess) {
      this.attachSession(sess);
    }
  }

  get receiverUrl() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('receiver-url') || '' : '';
  }

  set receiverUrl(val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('receiver-url', val);
      else this.removeAttribute('receiver-url');
    }
  }

  get docId() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('doc-id') || null : null;
  }

  set docId(val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('doc-id', val);
      else this.removeAttribute('doc-id');
    }
  }

  get theme() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('theme') || 'dark' : 'dark';
  }

  set theme(val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('theme', val);
      else this.removeAttribute('theme');
    }
  }

  get ttlMs() {
    const raw = typeof this.getAttribute === 'function' ? this.getAttribute('ttl') : null;
    return raw ? parseInt(raw, 10) : HANDOFF_DEFAULT_TTL_MS;
  }

  set ttlMs(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('ttl', String(val));
    }
  }

  get mode() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('mode') || 'batch' : 'batch';
  }

  set mode(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('mode', val);
    }
  }

  get aspect() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('aspect') || 'auto' : 'auto';
  }

  set aspect(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('aspect', val);
    }
  }

  get pages() {
    return [...this.#pages];
  }

  get token() {
    return this.#token;
  }

  get url() {
    return this.#url;
  }

  get relayUrl() {
    return this.#relayUrl || (typeof this.getAttribute === 'function' ? this.getAttribute('relay-url') || '' : '');
  }

  set relayUrl(val) {
    this.#relayUrl = val || '';
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('relay-url', val);
      else this.removeAttribute('relay-url');
    }
  }

  get signalingUrl() {
    return (
      this.#signalingUrl ||
      (typeof this.getAttribute === 'function' ? this.getAttribute('signaling-url') || '' : '')
    );
  }

  set signalingUrl(val) {
    this.#signalingUrl = val || '';
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('signaling-url', val);
      else this.removeAttribute('signaling-url');
    }
  }

  get iceServers() {
    if (this.#iceServers) return this.#iceServers;
    const attr = typeof this.getAttribute === 'function' ? this.getAttribute('ice-servers') : null;
    if (attr) {
      try {
        const parsed = JSON.parse(attr);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return attr.split(',').map((u) => ({ urls: u.trim() }));
      }
    }
    return null;
  }

  set iceServers(val) {
    if (Array.isArray(val)) {
      this.#iceServers = val;
    } else if (typeof val === 'string') {
      try {
        this.#iceServers = JSON.parse(val);
      } catch {
        this.#iceServers = val ? [{ urls: val }] : null;
      }
    } else {
      this.#iceServers = null;
    }
    if (typeof this.setAttribute === 'function') {
      if (Array.isArray(val)) this.setAttribute('ice-servers', JSON.stringify(val));
      else if (val) this.setAttribute('ice-servers', String(val));
      else this.removeAttribute('ice-servers');
    }
  }

  get iceTransportPolicy() {
    return typeof this.getAttribute === 'function'
      ? this.getAttribute('ice-transport-policy') || this.#iceTransportPolicy || 'all'
      : this.#iceTransportPolicy || 'all';
  }

  set iceTransportPolicy(val) {
    this.#iceTransportPolicy = val || 'all';
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('ice-transport-policy', val);
      else this.removeAttribute('ice-transport-policy');
    }
  }

  get transport() {
    if (this.#customTransport) return this.#customTransport;
    return typeof this.getAttribute === 'function'
      ? this.getAttribute('transport') || 'auto'
      : 'auto';
  }

  set transport(val) {
    if (typeof val === 'string') {
      if (typeof this.setAttribute === 'function') {
        this.setAttribute('transport', val);
      }
    } else {
      this.#customTransport = val;
    }
  }

  get connectionInfo() {
    return (
      this.#connectionInfo || {
        transport: /** @type {'direct'|'turn'} */ (
          this.iceTransportPolicy === 'relay' ? 'turn' : 'direct'
        ),
        rttMs: 0,
      }
    );
  }

  /**
   * Retrieves connection diagnostics for the active session.
   * @returns {Promise<{ transport: 'direct'|'turn', rttMs: number }>}
   */
  async getConnectionInfo() {
    if (this.#session && typeof this.#session.getConnectionInfo === 'function') {
      const info = await this.#session.getConnectionInfo();
      this.#connectionInfo = info;
      return info;
    }
    return this.connectionInfo;
  }

  // --- Public Methods ---

  /**
   * Starts a new host session and generates a fresh optical QR token.
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {string} [options.peerId]
   * @param {boolean} [options.peer]
   * @param {Object} [options.transport]
   * @returns {Promise<{ token: Object, url: string }>}
   */
  async start(options = {}) {
    this.#cleanupSession();
    this.#pages = [];
    this.#activeProgress = null;
    this.#errorMessage = '';

    let transport = options.transport || this.#customTransport;

    if (!transport) {
      const wantsPeer =
        Boolean(options.peer) ||
        this.getAttribute('transport') === 'peer' ||
        Boolean(this.relayUrl) ||
        Boolean(this.signalingUrl) ||
        Boolean(this.iceServers);

      const peerId =
        options.peerId ||
        (wantsPeer ? randomHandoffId('copio-hnd-') : randomHandoffId('peer_'));
      options.peerId = peerId;

      if (wantsPeer) {
        try {
          const { HandoffPeerTransport } = await import('../js/services/handoff-transport.js');
          transport = new HandoffPeerTransport({
            role: 'host',
            peerId,
            relayUrl: this.relayUrl,
            signalingUrl: this.signalingUrl,
            iceServers: this.iceServers,
            iceTransportPolicy: /** @type {'all'|'relay'} */ (this.iceTransportPolicy),
          });
        } catch (err) {
          console.warn('[CopioHandoff] Failed to initialize HandoffPeerTransport, falling back to loopback:', err);
          transport = new LoopbackTransport();
        }
      } else {
        const loopback = new LoopbackTransport();
        if (this.iceTransportPolicy === 'relay') {
          loopback.forceRelay = true;
          loopback.iceTransportPolicy = 'relay';
        }
        transport = loopback;
      }
    }

    const session = new HandoffSession({
      role: 'host',
      ttlMs: this.ttlMs,
      transport,
    });

    this.#session = session;
    this.#bindSessionEvents(session);

    const baseUrl = options.baseUrl || this.receiverUrl || this.#getDefaultBaseUrl();
    const { token, url } = await session.startHost({
      baseUrl,
      peerId: options.peerId,
      relayUrl: this.relayUrl,
      signalingUrl: this.signalingUrl,
      iceServers: this.iceServers,
    });

    if (transport instanceof LoopbackTransport && token?.peerId) {
      LoopbackTransport.register(token.peerId, transport);
    }

    this.#token = token;
    this.#url = url;
    this.#remainingSeconds = Math.max(0, Math.ceil((token.expiresAt - Date.now()) / 1000));
    this.#startCountdown(token.expiresAt);

    this.state = 'waiting';

    // Generate QR SVG
    this.#qrSvg = null;
    this.#render();
    try {
      this.#qrSvg = await generateQrSvg(url);
      if (this.#state === 'waiting') {
        this.#render();
      }
    } catch (err) {
      console.warn('[CopioHandoff] QR code generation error:', err);
    }

    return { token, url };
  }

  /**
   * Attaches an existing HandoffSession (e.g. LoopbackTransport in automated tests).
   * @param {HandoffSession} session
   * @param {Object} [token]
   */
  attachSession(session, token = null) {
    if (!session) return;
    this.#cleanupSession();
    this.#session = session;
    this.#token = token || session.token;
    if (this.#token?.expiresAt) {
      this.#remainingSeconds = Math.max(0, Math.ceil((this.#token.expiresAt - Date.now()) / 1000));
      this.#startCountdown(this.#token.expiresAt);
    }
    this.#bindSessionEvents(session);
    this.state = session.state === 'idle' ? 'waiting' : session.state;
  }

  /**
   * Regenerates a new QR code and session.
   */
  async refresh() {
    return this.start();
  }

  /**
   * Clears all received pages and resets back to waiting.
   */
  async clear() {
    this.#pages = [];
    this.#activeProgress = null;
    return this.start();
  }

  /**
   * Returns copy of received page entities.
   * @returns {Array<Object>}
   */
  getPages() {
    return [...this.#pages];
  }

  /**
   * Dispatches a public Copio event.
   * @param {string} eventName
   * @param {Object} [detail]
   */
  dispatch(eventName, detail = {}) {
    return dispatchCopioEvent(this, eventName, detail);
  }

  // --- Private Helpers ---

  #getDefaultBaseUrl() {
    if (typeof location !== 'undefined' && location.href) {
      return `${location.origin}${location.pathname}`;
    }
    return 'https://copio.netlify.app/scan';
  }

  #bindSessionEvents(session) {
    this.#unsubs.push(
      session.on('stateChange', (newState) => {
        if (newState === 'closed') return;
        this.state = newState;
        if (newState === 'connected') {
          this.dispatch(COPIO_EVENTS.HANDOFF_CONNECTED, {
            sessionId: this.#token?.sessionId || '',
            peerId: this.#token?.peerId || '',
          });
          session.getConnectionInfo().then((info) => {
            this.#connectionInfo = info;
            this.dispatch(COPIO_EVENTS.CONNECTION_INFO, info);
          }).catch(() => {});
        }
      }),

      session.on('connectionInfo', (info) => {
        this.#connectionInfo = info;
        this.dispatch(COPIO_EVENTS.CONNECTION_INFO, info);
      }),

      session.on('progress', (progress) => {
        this.#activeProgress = progress;
        if (this.#state !== 'receiving') {
          this.state = 'receiving';
        } else {
          this.#updateProgressDom();
        }
      }),

      session.on('page', (pageData) => {
        this.#handleIncomingPage(pageData);
      }),

      session.on('complete', (summary) => {
        this.#handleSessionComplete(summary);
      }),

      session.on('error', (err) => {
        this.#fail(err);
      })
    );
  }

  #handleIncomingPage(pageData) {
    let src = '';
    if (pageData.blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        src = URL.createObjectURL(pageData.blob);
      } catch {
        src = '';
      }
    }

    const pageIndex = typeof pageData.pageIndex === 'number' ? pageData.pageIndex : this.#pages.length;
    const pageNumber = this.#pages.length + 1;
    const page = {
      id: pageData.id || randomHandoffId('page_'),
      pageIndex,
      pageNumber,
      label: `Page ${pageNumber}`,
      mimeType: pageData.mimeType || 'image/jpeg',
      blob: pageData.blob,
      src,
      originalSrc: src,
      originalPreserved: true,
      dimensions: pageData.metadata?.width
        ? { width: pageData.metadata.width, height: pageData.metadata.height }
        : { width: 0, height: 0 },
      edits: { crop: { x: 0, y: 0, w: 1, h: 1 }, rotate: 0, filter: 'none' },
      ocrText: null,
    };

    this.#pages.push(page);
    this.#activeProgress = null;

    this.dispatch(COPIO_EVENTS.PAGE_ADDED, {
      page,
      pageNumber: page.pageNumber,
      docId: this.docId || this.#targetDocId,
      source: 'handoff',
    });

    if (this.#state === 'receiving') {
      this.state = 'connected';
    } else {
      this.#render();
    }
  }

  #handleSessionComplete(details = {}) {
    this.#stopCountdown();
    this.state = 'complete';

    const payload = {
      mode: this.mode,
      aspect: this.aspect,
      docId: this.docId || details.docId || this.#targetDocId,
      pageCount: this.#pages.length,
      pages: [...this.#pages],
      summary: details.summary || {},
    };

    this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, payload);
  }

  #fail(err) {
    this.#stopCountdown();
    this.#errorMessage = err?.message || String(err);
    this.state = 'error';
    this.dispatch(COPIO_EVENTS.ERROR, {
      code: 'HANDOFF_ERROR',
      message: this.#errorMessage,
      error: err,
    });
  }

  #startCountdown(expiresAt) {
    this.#stopCountdown();
    this.#countdownInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      this.#remainingSeconds = remaining;
      if (remaining <= 0) {
        this.#stopCountdown();
        this.state = 'expired';
      } else {
        const timerEl = this.shadowRoot?.querySelector('.copio-handoff-countdown');
        if (timerEl) {
          timerEl.textContent = this.#formatTime(remaining);
        }
      }
    }, 1000);
  }

  #stopCountdown() {
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
      this.#countdownInterval = null;
    }
  }

  #cleanupSession() {
    for (const unsub of this.#unsubs) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.#unsubs = [];
    if (this.#session) {
      try {
        this.#session.close();
      } catch {
        // ignore
      }
      this.#session = null;
    }
  }

  #formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // --- File Fallback Handler ---

  async #handleLocalFileUpload(files) {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let src = '';
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
          src = URL.createObjectURL(file);
        } catch {
          src = '';
        }
      }

      const pageIndex = this.#pages.length;
      const pageNumber = pageIndex + 1;
      const page = {
        id: randomHandoffId('page_'),
        pageIndex,
        pageNumber,
        label: file.name || `Page ${pageNumber}`,
        mimeType: file.type || 'image/jpeg',
        blob: file,
        src,
        originalSrc: src,
        originalPreserved: true,
        dimensions: { width: 0, height: 0 },
        edits: { crop: { x: 0, y: 0, w: 1, h: 1 }, rotate: 0, filter: 'none' },
        ocrText: null,
      };

      this.#pages.push(page);

      this.dispatch(COPIO_EVENTS.PAGE_ADDED, {
        page,
        pageNumber,
        docId: this.docId || this.#targetDocId,
        source: 'file',
      });
    }

    this.state = 'complete';

    const payload = {
      mode: this.mode,
      aspect: this.aspect,
      docId: this.docId || this.#targetDocId,
      pageCount: this.#pages.length,
      pages: [...this.#pages],
      source: 'file',
      summary: { source: 'local_upload', count: files.length },
    };

    this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, payload);
  }

  // --- Rendering ---

  #updateProgressDom() {
    if (!this.shadowRoot) return;
    const fillEl = /** @type {HTMLElement|null} */ (this.shadowRoot.querySelector('.copio-handoff-progress-fill'));
    const labelEl = this.shadowRoot.querySelector('.copio-handoff-progress-pct');
    if (fillEl && this.#activeProgress) {
      fillEl.style.width = `${this.#activeProgress.percent || 0}%`;
    }
    if (labelEl && this.#activeProgress) {
      labelEl.textContent = `${this.#activeProgress.percent || 0}%`;
    }
  }

  #render() {
    if (!this.shadowRoot) return;

    let content = '';
    switch (this.#state) {
      case 'waiting':
        content = this.#renderWaitingState();
        break;
      case 'connected':
        content = this.#renderConnectedState();
        break;
      case 'receiving':
        content = this.#renderReceivingState();
        break;
      case 'complete':
        content = this.#renderCompleteState();
        break;
      case 'expired':
        content = this.#renderExpiredState();
        break;
      case 'error':
        content = this.#renderErrorState();
        break;
      default:
        content = this.#renderWaitingState();
    }

    this.shadowRoot.innerHTML = `
      <div class="copio-handoff-root">
        <div class="copio-handoff-card">
          ${content}
        </div>
      </div>
    `;

    this.#attachListeners();
  }

  #renderWaitingState() {
    const formatted = this.#formatTime(this.#remainingSeconds);
    const qrDisplay = this.#qrSvg
      ? this.#qrSvg
      : `
        <div class="copio-handoff-qr-loading">
          <div class="copio-handoff-spinner"></div>
          <span>Generating QR code…</span>
        </div>
      `;

    return `
      <h2 class="copio-handoff-title">Scan with your phone camera</h2>
      <p class="copio-handoff-desc">Point your smartphone camera at the code below to snap document pages with zero app install.</p>

      <div class="copio-handoff-qr-box" data-testid="qr-container">
        ${qrDisplay}
      </div>

      <div class="copio-handoff-meta-row">
        <span class="copio-handoff-timer-badge" title="Session time remaining">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Expires in <span class="copio-handoff-countdown">${formatted}</span>
        </span>
        <button class="copio-handoff-icon-btn copio-handoff-refresh-btn" type="button" title="Refresh QR code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>

      <div class="copio-handoff-divider">
        <span>OR</span>
      </div>

      <button class="copio-handoff-btn copio-handoff-btn-secondary copio-handoff-upload-btn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Or upload file on this computer
      </button>
      <input type="file" class="copio-handoff-file-input" accept="image/*,application/pdf" multiple style="display:none">
    `;
  }

  #renderConnectedState() {
    const pageCount = this.#pages.length;
    const badgeText = pageCount === 1 ? '1 page snapped' : `${pageCount} pages snapped`;

    return `
      <div class="copio-handoff-status-pill">
        <span class="copio-handoff-pulse-dot"></span>
        <span>Phone connected — scanning in progress…</span>
      </div>

      <h2 class="copio-handoff-title">Ready for Captures</h2>
      <p class="copio-handoff-desc">Snap pages or receipts on your phone. They will transfer securely with end-to-end encryption.</p>

      <div class="copio-handoff-badge" data-testid="page-count-badge">${badgeText}</div>

      ${this.#renderThumbnails(false)}
    `;
  }

  #renderReceivingState() {
    const p = this.#activeProgress || { percent: 0, pageIndex: this.#pages.length };
    const pageNum = (p.pageIndex || this.#pages.length) + 1;
    const percent = p.percent || 0;

    return `
      <div class="copio-handoff-status-pill">
        <div class="copio-handoff-spinner" style="width:12px;height:12px;border-width:2px;margin-right:4px;"></div>
        <span>Receiving page ${pageNum}…</span>
      </div>

      <h2 class="copio-handoff-title">Streaming Page ${pageNum}</h2>
      <p class="copio-handoff-desc">Decrypting 64 KB binary chunks directly in memory.</p>

      <div class="copio-handoff-progress-wrap">
        <div class="copio-handoff-progress-bar">
          <div class="copio-handoff-progress-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="copio-handoff-progress-label">
          <span>Receiving page ${pageNum}</span>
          <span class="copio-handoff-progress-pct">${percent}%</span>
        </div>
      </div>

      ${this.#renderThumbnails(true)}
    `;
  }

  #renderCompleteState() {
    const count = this.#pages.length;
    const pageDesc = count === 1 ? '1 page received' : `${count} pages received`;

    return `
      <div class="copio-handoff-success-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>

      <h2 class="copio-handoff-title">Scan Complete</h2>
      <p class="copio-handoff-desc">${pageDesc} successfully transferred to this computer.</p>

      ${this.#renderThumbnails(false)}

      <button class="copio-handoff-btn copio-handoff-btn-primary copio-handoff-reset-btn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Scan
      </button>
    `;
  }

  #renderExpiredState() {
    return `
      <div class="copio-handoff-alert">
        <div class="copio-handoff-alert-icon warning">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h2 class="copio-handoff-title">QR Code Expired</h2>
        <p class="copio-handoff-desc">For security, handoff QR codes are single-use and expire after 10 minutes.</p>
      </div>

      <button class="copio-handoff-btn copio-handoff-btn-primary copio-handoff-retry-btn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        Generate new QR code
      </button>
    `;
  }

  #renderErrorState() {
    return `
      <div class="copio-handoff-alert">
        <div class="copio-handoff-alert-icon danger">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 class="copio-handoff-title">Connection Error</h2>
        <p class="copio-handoff-desc">${this.#errorMessage || 'Unable to establish secure peer connection.'}</p>
      </div>

      <button class="copio-handoff-btn copio-handoff-btn-primary copio-handoff-retry-btn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        Generate new QR code
      </button>
    `;
  }

  #renderThumbnails(showShimmerPlaceholder = false) {
    if (this.#pages.length === 0 && !showShimmerPlaceholder) {
      return '';
    }

    const cards = this.#pages.map((p, idx) => `
      <div class="copio-handoff-thumb-card" data-page-id="${p.id}">
        ${p.src ? `<img class="copio-handoff-thumb-img" src="${p.src}" alt="${p.label || `Page ${idx + 1}`}">` : ''}
        <span class="copio-handoff-thumb-label">P${idx + 1}</span>
      </div>
    `).join('');

    const shimmerCard = showShimmerPlaceholder
      ? `
        <div class="copio-handoff-thumb-card">
          <div class="copio-handoff-thumb-shimmer">
            <div class="copio-handoff-spinner" style="width:14px;height:14px;border-width:2px;"></div>
          </div>
        </div>
      `
      : '';

    return `
      <div class="copio-handoff-thumbnails" data-testid="thumbnail-grid">
        ${cards}
        ${shimmerCard}
      </div>
    `;
  }

  #attachListeners() {
    if (!this.shadowRoot) return;

    // Refresh / Retry button
    const refreshBtn = this.shadowRoot.querySelector('.copio-handoff-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refresh();
      });
    }

    const retryBtn = this.shadowRoot.querySelector('.copio-handoff-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.refresh();
      });
    }

    const resetBtn = this.shadowRoot.querySelector('.copio-handoff-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.clear();
      });
    }

    // File Upload Fallback
    const uploadBtn = this.shadowRoot.querySelector('.copio-handoff-upload-btn');
    const fileInput = /** @type {HTMLInputElement|null} */ (this.shadowRoot.querySelector('.copio-handoff-file-input'));
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        if (target.files && target.files.length > 0) {
          this.#handleLocalFileUpload(Array.from(target.files));
        }
      });
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('copio-handoff')) {
  customElements.define('copio-handoff', CopioHandoff);
}

export {
  COPIO_EVENTS,
  dispatchCopioEvent,
  handoffCss,
  getHandoffStyleSheet,
  adoptHandoffStyles,
  HandoffSession,
  LoopbackTransport,
  randomHandoffId,
  encodeSessionToken,
  decodeSessionToken,
  buildHandoffUrl,
  parseHandoffUrl,
  HANDOFF_DEFAULT_CHUNK_SIZE,
  HANDOFF_DEFAULT_TTL_MS,
  generateEcdhKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptPayload,
  decryptPayload,
};
