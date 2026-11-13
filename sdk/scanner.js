// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Scanner Web Component (CPO-034, CPO-035, CPO-036, CPO-037, CPO-038, CPO-045)
 * 
 * Embeddable, zero-config two-stage (viewfinder ↔ workbench) document scanner
 * acting as the primary Driving UI Adapter over the headless CopioEngine.
 */
import {
  CopioEngine,
  cropRectToQuad,
  quadToCropRect,
  quadRotatedToOriginal,
  quadOriginalToRotated,
  cloneQuad,
  getRegisteredService,
} from './core.js';
import { COPIO_EVENTS, dispatchCopioEvent } from './events.js';
import { setAssetBase } from '../js/utils/module-loader.js';
import { notify, setContainer, getContainer } from '../js/services/notify.js';
import { scannerCss, getScannerStyleSheet, adoptScannerStyles } from './styles.js';
import {
  HandoffSession,
  LoopbackTransport,
  parseHandoffUrl,
  decodeSessionToken,
} from '../js/services/handoff-session.js';

/** @type {typeof HTMLElement} */
const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : /** @type {any} */ (class {});

export class CopioScanner extends BaseElement {
  #engine = null;
  #storage = null;
  #unsubscribeRepo = null;
  #isOpen = false;
  #stage = 'viewfinder'; // 'viewfinder' | 'workbench'
  #activePageIndex = 0;
  #pageCount = 0;
  #retaking = false;
  #cropMode = false;
  #draftQuad = null;
  #undoTimer = null;
  #undoRemaining = 0;
  #renderPromise = null;
  #sessionDocId = null;
  #cameraStream = null;
  #wasStreamingBeforeHide = false;
  #grabCanvas = null;
  #edgeDetection = true;
  #edgeModel = 'ml';
  #autoCrop = true;
  #autoCapture = false;
  #liveEdgeRafId = null;
  #isDetectingEdge = false;
  #lastEdgeDetectTime = 0;
  #smoothedQuad = null;
  #latestDetectionResult = null;
  #consecutiveMisses = 0;
  #stableQuadStartTime = 0;
  #lastStableQuad = null;
  #handoffSession = null;
  #handoffToken = null;
  #handoffState = 'idle'; // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'sending' | 'complete' | 'error'
  #handoffUnsubs = [];
  #handoffProgress = null;
  #handoffRetryCount = 0;
  onShutter = null;

  get #targetDocId() {
    if (this.docId) return this.docId;
    if (!this.#sessionDocId) {
      this.#sessionDocId = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }
    return this.#sessionDocId;
  }

  static get observedAttributes() {
    return [
      'mode',
      'aspect',
      'stage',
      'doc-id',
      'features',
      'export-formats',
      'ocr-languages',
      'max-pages',
      'asset-base',
      'license-key',
      'theme',
      'ocr',
      'pdf',
      'handoff',
      'relay-url',
      'ice-servers',
      'signaling-url',
      'ice-transport-policy',
      'edge-detection',
      'edge-model',
      'auto-crop',
      'auto-capture',
    ];
  }

  constructor() {
    super();
    if (typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
    }
    this.#initEngine();
  }

  #initEngine() {
    const opts = {
      storage: this.#storage,
    };
    if (typeof this.getAttribute === 'function') {
      if (this.hasAttribute('features')) opts.features = this.getAttribute('features');
      if (this.hasAttribute('export-formats')) opts.exportFormats = this.getAttribute('export-formats');
      if (this.hasAttribute('ocr-languages')) opts.ocrLanguages = this.getAttribute('ocr-languages');
      if (this.hasAttribute('max-pages')) opts.maxPages = this.getAttribute('max-pages');
      if (this.hasAttribute('asset-base')) opts.assetBase = this.getAttribute('asset-base');
      if (this.hasAttribute('license-key')) opts.licenseKey = this.getAttribute('license-key');
      if (this.hasAttribute('ocr')) opts.ocr = this.getAttribute('ocr') !== 'false';
      if (this.hasAttribute('pdf')) opts.pdf = this.getAttribute('pdf') !== 'false';
      if (this.hasAttribute('edge-detection')) this.#edgeDetection = this.getAttribute('edge-detection') !== 'false';
      if (this.hasAttribute('edge-model')) this.#edgeModel = this.getAttribute('edge-model') === 'classical' ? 'classical' : 'ml';
      if (this.hasAttribute('auto-crop')) this.#autoCrop = this.getAttribute('auto-crop') !== 'false';
      if (this.hasAttribute('auto-capture')) this.#autoCapture = this.getAttribute('auto-capture') !== 'false' && this.getAttribute('auto-capture') !== null;
      for (const k of ['relay-url', 'signaling-url', 'ice-transport-policy']) {
        if (this.hasAttribute(k)) opts[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = this.getAttribute(k);
      }
      if (this.hasAttribute('ice-servers')) {
        try { opts.iceServers = JSON.parse(this.getAttribute('ice-servers')); }
        catch { opts.iceServers = [{ urls: this.getAttribute('ice-servers') }]; }
      }
    }
    this.#engine = new CopioEngine(opts);
    this.#engine.addEventListener(COPIO_EVENTS.MIGRATION, (e) => {
      this.dispatch(COPIO_EVENTS.MIGRATION, e.detail);
    });
  }

  connectedCallback() {
    if (this.shadowRoot) {
      adoptScannerStyles(this.shadowRoot);
      this.#buildInitialDom();
    }

    if (typeof setContainer === 'function' && typeof document !== 'undefined' && getContainer() === document.body) {
      setContainer(this.shadowRoot?.querySelector('.copio-scanner-container') || this);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.#onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.#onPageHide);
    }

    // Initialize engine & run migrations
    if (this.#engine) {
      this.#engine.init().catch((err) => {
        console.error('[CopioScanner] Engine initialization failed:', err);
      });
      this.#unsubscribeRepo = this.#engine.subscribe(async () => {
        const pages = await this.getPages();
        this.dispatch(COPIO_EVENTS.PAGES_CHANGED, {
          pages,
          docId: this.docId,
        });
        this.#syncView();
      });
    }

    if (this.hasAttribute && this.hasAttribute('asset-base')) {
      setAssetBase(this.getAttribute('asset-base'));
    }

    if (this.#isHandoffMode()) {
      this.#initHandoffMode().catch((err) => {
        console.warn('[CopioScanner] Handoff init error:', err);
      });
    }

    this.#updateChildViews();
    this.#syncView();
  }

  disconnectedCallback() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.#onPageHide);
    }
    this.#cleanupHandoff();
    this.#stopCameraStream();
    if (this.#grabCanvas) {
      this.#grabCanvas.width = 0;
      this.#grabCanvas.height = 0;
      this.#grabCanvas = null;
    }
    if (typeof this.#unsubscribeRepo === 'function') {
      this.#unsubscribeRepo();
      this.#unsubscribeRepo = null;
    }
    if (this.#undoTimer) {
      clearInterval(this.#undoTimer);
      this.#undoTimer = null;
    }
    if (typeof setContainer === 'function' && typeof document !== 'undefined') {
      const containerEl = this.shadowRoot?.querySelector('.copio-scanner-container') || this;
      if (getContainer() === containerEl) {
        setContainer(null);
      }
    }
  }

  #onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (this.#cameraStream) {
        this.#wasStreamingBeforeHide = true;
        this.#stopCameraStream();
      }
    } else if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      if (this.#wasStreamingBeforeHide && this.#stage === 'viewfinder') {
        this.#wasStreamingBeforeHide = false;
        this.startCamera().catch(() => {});
      }
      // Mobile browser returning from background: verify handoff connection
      if (this.#isHandoffMode() && this.#handoffSession && !this.#handoffSession.isConnected && this.#handoffState !== 'complete') {
        this.reconnectHandoff().catch(() => {});
      }
    }
  };

  #onPageHide = () => {
    this.#stopCameraStream();
  };

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#engine) return;

    switch (name) {
      case 'features':
        this.#engine.setFeatures(newValue);
        this.#updateChildViews();
        break;
      case 'export-formats':
        this.#engine.exportFormats = newValue;
        this.#updateChildViews();
        break;
      case 'ocr-languages':
        this.#engine.ocrLanguages = newValue;
        break;
      case 'asset-base':
        this.#engine.assetBase = newValue;
        break;
      case 'license-key':
        this.#engine.licenseKey = newValue;
        break;
      case 'ocr':
        this.#engine.ocr = newValue !== 'false';
        this.#updateChildViews();
        break;
      case 'pdf':
        this.#engine.pdf = newValue !== 'false';
        this.#updateChildViews();
        break;
      case 'relay-url':
      case 'signaling-url':
      case 'ice-transport-policy':
        if (this.#engine) this.#engine[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = newValue;
        break;
      case 'ice-servers':
        if (this.#engine) {
          try { this.#engine.iceServers = JSON.parse(newValue); }
          catch { this.#engine.iceServers = newValue ? [{ urls: newValue }] : null; }
        }
        break;
      case 'stage':
        if (newValue === 'viewfinder' || newValue === 'workbench') {
          this.#stage = newValue;
          if (newValue === 'workbench') {
            this.#stopCameraStream();
          }
          const shadow = this.shadowRoot;
          if (shadow) {
            const vf = shadow.getElementById('viewfinder-section');
            const wb = shadow.getElementById('workbench-section');
            if (vf && wb) {
              vf.style.display = newValue === 'viewfinder' ? 'flex' : 'none';
              wb.style.display = newValue === 'workbench' ? 'flex' : 'none';
            }
          }
          this.#syncView();
        }
        break;
      case 'max-pages':
        this.#engine.maxPages = newValue;
        this.#syncView();
        break;
      case 'mode':
      case 'aspect':
      case 'theme':
        this.#syncView();
        break;
      case 'handoff':
        if (newValue && newValue !== 'false') {
          this.#initHandoffMode().catch(() => {});
        } else if (newValue === 'false') {
          this.#cleanupHandoff();
        }
        break;
      case 'edge-detection':
        this.edgeDetection = newValue !== 'false';
        break;
      case 'edge-model':
        this.edgeModel = newValue === 'classical' ? 'classical' : 'ml';
        break;
      case 'auto-crop':
        this.autoCrop = newValue !== 'false';
        break;
      case 'auto-capture':
        this.autoCapture = newValue !== 'false' && newValue !== null;
        break;
    }
  }

  #updateChildViews() {
    if (typeof this.querySelectorAll !== 'function') return;
    const roots = [];
    if (this.shadowRoot) roots.push(this.shadowRoot);
    roots.push(this);

    for (const root of roots) {
      const children = root.querySelectorAll('copio-carousel, copio-row, copio-images');
      for (const child of children) {
        if ('ocr' in child) /** @type {any} */ (child).ocr = this.ocrEnabled;
        if ('pdf' in child) /** @type {any} */ (child).pdf = this.pdf;
      }
    }
  }

  #buildInitialDom() {
    if (!this.shadowRoot || this.shadowRoot.innerHTML) return;

    let initialStepText = 'Align Document Inside Frame';
    if (this.aspect === 'card') {
      initialStepText = 'Step 1 of 2: Capture Front of ID Card';
    } else if (this.mode === 'batch') {
      initialStepText = 'Batch Capture · Page 1';
    }

    this.shadowRoot.innerHTML = `
      <div class="copio-scanner-container copio-scanner-host" part="scanner-root">
        <header class="copio-header" part="header">
          <div class="copio-header-left">
            <span class="copio-mode-badge" id="mode-badge">${(this.mode || 'single').toUpperCase()}</span>
            <div class="copio-title-group">
              <h2 class="copio-title" id="header-title">Copio Scanner</h2>
              <p class="copio-subtitle" id="header-subtitle">Non-destructive mobile document scanner</p>
            </div>
          </div>
          <div class="copio-header-actions" part="header-actions">
            <div class="copio-stage-tabs" role="tablist" aria-label="Scanner Stage">
              <button type="button" class="copio-stage-tab" id="tab-viewfinder" role="tab" aria-selected="true">Camera</button>
              <button type="button" class="copio-stage-tab" id="tab-workbench" role="tab" aria-selected="false">Workbench</button>
            </div>
            <slot name="header-actions"></slot>
          </div>
        </header>

        <!-- Viewfinder Stage -->
        <div class="copio-viewfinder copio-viewfinder-stage" part="viewfinder" id="viewfinder-section">
          <div class="copio-viewfinder-hud-top">
            <div class="copio-step-pill" id="step-pill">
              <span class="copio-status-dot"></span>
              <span id="step-pill-text">${initialStepText}</span>
            </div>
            <div class="copio-handoff-pill" id="handoff-pill" style="display:none;" title="Phone-to-Desktop Handoff">
              <span class="copio-handoff-dot" id="handoff-dot"></span>
              <span class="copio-handoff-status-text" id="handoff-status-text">Paired with computer</span>
              <button type="button" class="copio-handoff-retry-btn" id="btn-handoff-retry" style="display:none;" title="Retry connection">Retry</button>
            </div>
            <div class="copio-privacy-pill" title="100% Local On-Device Processing">
              <span>🔒 100% Local</span>
            </div>
          </div>

          <div class="copio-camera-feed" id="camera-feed">
            <video id="camera-video" autoplay playsinline webkit-playsinline muted style="display:none; position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;"></video>
            <svg class="copio-live-quad-overlay" id="live-quad-overlay" style="display:none;" aria-hidden="true">
              <polygon class="copio-live-quad-polygon" id="live-quad-polygon" points=""></polygon>
              <circle class="copio-live-quad-corner" id="live-quad-c0" r="5"></circle>
              <circle class="copio-live-quad-corner" id="live-quad-c1" r="5"></circle>
              <circle class="copio-live-quad-corner" id="live-quad-c2" r="5"></circle>
              <circle class="copio-live-quad-corner" id="live-quad-c3" r="5"></circle>
            </svg>
            <slot name="viewfinder">
              <div class="copio-framing-guide" id="framing-guide" data-aspect="${this.aspect}">
                <span class="copio-corner tl"></span>
                <span class="copio-corner tr"></span>
                <span class="copio-corner bl"></span>
                <span class="copio-corner br"></span>
                <div class="copio-edge-quad"></div>
                <div class="copio-camera-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Position document within guide lines</span>
                </div>
              </div>
            </slot>
          </div>

          <div class="copio-shutter-dock" part="shutter-dock">
            <div class="copio-shutter-side left">
              <button type="button" class="copio-btn copio-btn-secondary" id="btn-import-file" title="Import image from file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Import</span>
              </button>
            </div>

            <slot name="shutter-dock">
              <button type="button" class="copio-shutter-btn" id="btn-shutter" aria-label="Capture page">
                <span class="copio-shutter-btn-inner"></span>
              </button>
            </slot>

            <div class="copio-shutter-side right">
              <button type="button" class="copio-stack-pill" id="btn-review" title="Review pages" style="display:none;">
                <span id="review-pill-text">Review (0) →</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Workbench Stage -->
        <div class="copio-workbench copio-workbench-stage" part="workbench" id="workbench-section" style="display: none;">
          <div class="copio-workbench-main">
            <div class="copio-canvas-viewport" id="canvas-viewport">
              <div class="copio-card-side-switcher" id="card-side-switcher" style="display:none;" role="tablist" aria-label="Card side switcher">
                <button type="button" role="tab" class="copio-side-pill active" id="btn-card-front" aria-selected="true">1. Front Side</button>
                <button type="button" role="tab" class="copio-side-pill" id="btn-card-back" aria-selected="false">2. Back Side</button>
              </div>

              <div class="copio-canvas-wrapper" id="canvas-wrapper">
                <img id="stage-img" class="copio-stage-image" alt="Active document page" />
              </div>
            </div>

            <!-- Filmstrip Tray -->
            <div class="copio-filmstrip" id="filmstrip-tray" part="filmstrip">
              <div class="copio-filmstrip-scroll" id="filmstrip-scroll">
                <slot name="filmstrip"></slot>
              </div>
            </div>
          </div>

          <!-- Bottom Action Toolbar -->
          <footer class="copio-toolbar" part="toolbar" id="workbench-toolbar">
            <div class="copio-toolbar-tools">
              <button type="button" class="copio-tool-btn" id="btn-retake" title="Retake page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                <span>Retake</span>
              </button>

              <button type="button" class="copio-tool-btn" id="btn-crop" title="Adjust crop">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
                  <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
                </svg>
                <span id="crop-btn-label">Crop</span>
              </button>

              <button type="button" class="copio-tool-btn" id="btn-rotate" title="Rotate 90°">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>Rotate</span>
              </button>

              <button type="button" class="copio-tool-btn" id="btn-filter-bw" title="Toggle B&W filter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>
                </svg>
                <span>B&W</span>
              </button>

              <button type="button" class="copio-tool-btn" id="btn-ocr" title="Recognize text">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
                </svg>
                <span>OCR</span>
              </button>

              <button type="button" class="copio-tool-btn copio-btn-danger" id="btn-delete" title="Delete active page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Delete</span>
              </button>
            </div>

            <div class="copio-toolbar-actions">
              <slot name="toolbar">
                <button type="button" class="copio-btn copio-btn-primary" id="btn-primary-complete">
                  ✓ Use Photo
                </button>
              </slot>
            </div>
          </footer>

          <!-- Scoped OCR Slide-out / Bottom Sheet -->
          <div class="copio-ocr-sheet" id="ocr-sheet" style="display:none;" part="ocr-sheet">
            <div class="copio-ocr-header">
              <strong class="copio-ocr-title">Text Recognition (OCR)</strong>
              <button type="button" class="copio-btn copio-btn-secondary" id="btn-close-ocr">✕</button>
            </div>
            <div class="copio-ocr-body" id="ocr-body">
              <p class="copio-ocr-placeholder">Select text or extract full page data...</p>
            </div>
          </div>

          <!-- Container-scoped Toast Region (5s undo) -->
          <div class="copio-toast-region" id="toast-region" aria-live="polite"></div>
        </div>

        <!-- Mobile Handoff Progress Overlay -->
        <div class="copio-handoff-progress-view" id="handoff-progress-view" style="display: none;" part="handoff-progress">
          <div class="copio-handoff-progress-card">
            <div class="copio-handoff-spinner"></div>
            <h4 class="copio-handoff-progress-title" id="handoff-progress-title">Sending to your computer…</h4>
            <div class="copio-handoff-progress-track">
              <div class="copio-handoff-progress-bar" id="handoff-progress-bar" style="width: 0%;"></div>
            </div>
            <p class="copio-handoff-progress-desc" id="handoff-progress-desc">Encrypting and streaming pages…</p>
          </div>
        </div>

        <!-- Mobile Handoff Confirmation Screen (CPO-094) -->
        <div class="copio-handoff-confirm" id="handoff-confirm-view" style="display: none;" part="handoff-confirm">
          <div class="copio-handoff-confirm-card">
            <div class="copio-handoff-confirm-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h3 class="copio-handoff-confirm-title">Sent to your computer</h3>
            <p class="copio-handoff-confirm-subtitle">You can close this tab now.</p>
            <div class="copio-handoff-confirm-badge" id="handoff-confirm-count">1 page transferred</div>
            <div class="copio-handoff-confirm-actions">
              <button type="button" class="copio-btn copio-btn-secondary" id="btn-handoff-scan-more">
                Scan More Documents
              </button>
            </div>
          </div>
        </div>

        <!-- Hidden input for file picker fallback -->
        <input type="file" id="internal-file-input" accept="image/*" style="display: none;" />
        <slot></slot>
      </div>
    `;

    this.#bindEventListeners();
  }

  #bindEventListeners() {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Stage toggle tabs
    shadow.getElementById('tab-viewfinder')?.addEventListener('click', () => {
      this.stage = 'viewfinder';
    });
    shadow.getElementById('tab-workbench')?.addEventListener('click', () => {
      this.stage = 'workbench';
    });

    // File input fallback
    const fileInput = shadow.getElementById('internal-file-input');
    shadow.getElementById('btn-import-file')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
      const input = /** @type {HTMLInputElement} */ (e.target);
      if (input.files && input.files.length > 0) {
        await this.addFiles(input.files);
        input.value = '';
      }
    });

    // Shutter capture button
    shadow.getElementById('btn-shutter')?.addEventListener('click', async () => {
      await this.#handleShutterClick();
    });

    // Tap to start camera from placeholder or camera feed in standby
    shadow.getElementById('camera-feed')?.addEventListener('click', async (e) => {
      if (e.target && /** @type {HTMLElement} */ (e.target).closest('button, input, a, select')) return;
      if (!this.#cameraStream && this.#stage === 'viewfinder') {
        await this.startCamera().catch(() => {});
      }
    });

    // Review pill
    shadow.getElementById('btn-review')?.addEventListener('click', () => {
      this.stage = 'workbench';
    });

    // Workbench tools
    shadow.getElementById('btn-retake')?.addEventListener('click', () => {
      this.#retaking = true;
      this.#cropMode = false;
      this.stage = 'viewfinder';
    });

    shadow.getElementById('btn-rotate')?.addEventListener('click', async () => {
      await this.#rotateActivePage();
    });

    shadow.getElementById('btn-filter-bw')?.addEventListener('click', async () => {
      await this.#toggleActivePageBw();
    });

    shadow.getElementById('btn-crop')?.addEventListener('click', async () => {
      await this.#toggleCropMode();
    });

    shadow.getElementById('btn-delete')?.addEventListener('click', async () => {
      await this.#deleteActivePageWithUndo();
    });

    shadow.getElementById('btn-ocr')?.addEventListener('click', async () => {
      await this.#openOcrSheet();
    });

    shadow.getElementById('btn-close-ocr')?.addEventListener('click', () => {
      this.#closeOcrSheet();
    });

    shadow.getElementById('btn-primary-complete')?.addEventListener('click', async () => {
      await this.#handlePrimaryCtaClick();
    });

    // Handoff buttons
    shadow.getElementById('btn-handoff-retry')?.addEventListener('click', () => {
      this.reconnectHandoff().catch(() => {});
    });
    shadow.getElementById('btn-handoff-scan-more')?.addEventListener('click', async () => {
      await this.resetHandoff();
    });

    // Card switcher buttons
    shadow.getElementById('btn-card-front')?.addEventListener('click', () => {
      this.#cropMode = false;
      this.#activePageIndex = 0;
      this.#syncView();
    });

    shadow.getElementById('btn-card-back')?.addEventListener('click', () => {
      this.#cropMode = false;
      this.#activePageIndex = 1;
      this.#syncView();
    });

    // Crop handle dragging
    this.#bindCropHandles();
  }

  #bindCropHandles() {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const quadOutline = shadow.getElementById('crop-quad-outline');
    const handles = shadow.querySelectorAll('.copio-crop-handle');
    if (!quadOutline || handles.length === 0) return;

    let activeCorner = null;
    let isDraggingQuad = false;
    let startX = 0;
    let startY = 0;
    let initialQuad = null;

    const updateMagnifier = (normX, normY) => {
      const mag = /** @type {HTMLCanvasElement|null} */ (shadow.getElementById('crop-magnifier'));
      const stageImg = /** @type {HTMLImageElement|null} */ (shadow.getElementById('stage-img'));
      if (!mag || !stageImg || !stageImg.complete || !stageImg.naturalWidth) return;

      mag.style.display = 'block';
      mag.style.left = `${(normX * 100).toFixed(2)}%`;
      mag.style.top = `${(normY * 100).toFixed(2)}%`;
      mag.style.transform = normY < 0.25 ? 'translate(-50%, 35%)' : 'translate(-50%, -125%)';

      const mCtx = mag.getContext('2d');
      if (!mCtx) return;
      const zoom = 2;
      const w = mag.width;
      const h = mag.height;
      const srcW = stageImg.naturalWidth;
      const srcH = stageImg.naturalHeight;
      const sampleW = w / zoom;
      const sampleH = h / zoom;
      const cx = normX * srcW;
      const cy = normY * srcH;

      mCtx.clearRect(0, 0, w, h);
      mCtx.fillStyle = '#0b0f17';
      mCtx.fillRect(0, 0, w, h);
      mCtx.drawImage(
        stageImg,
        cx - sampleW / 2,
        cy - sampleH / 2,
        sampleW,
        sampleH,
        0,
        0,
        w,
        h,
      );

      // Crosshair
      mCtx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      mCtx.lineWidth = 1.5;
      mCtx.beginPath();
      mCtx.moveTo(w / 2 - 10, h / 2);
      mCtx.lineTo(w / 2 + 10, h / 2);
      mCtx.moveTo(w / 2, h / 2 - 10);
      mCtx.lineTo(w / 2, h / 2 + 10);
      mCtx.stroke();
    };

    const hideMagnifier = () => {
      const mag = shadow.getElementById('crop-magnifier');
      if (mag) mag.style.display = 'none';
    };

    const onPointerDown = (e) => {
      const handleEl = e.target.closest('.copio-crop-handle');
      if (handleEl) {
        activeCorner = handleEl.getAttribute('data-corner');
        isDraggingQuad = false;
      } else if (e.target === quadOutline) {
        activeCorner = null;
        isDraggingQuad = true;
      } else {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      startX = e.clientX;
      startY = e.clientY;
      initialQuad = this.#draftQuad
        ? cloneQuad(this.#draftQuad)
        : {
            topLeft: { x: 0.05, y: 0.05 },
            topRight: { x: 0.95, y: 0.05 },
            bottomRight: { x: 0.95, y: 0.95 },
            bottomLeft: { x: 0.05, y: 0.95 },
          };

      if (activeCorner && initialQuad[activeCorner]) {
        updateMagnifier(initialQuad[activeCorner].x, initialQuad[activeCorner].y);
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if ((!activeCorner && !isDraggingQuad) || !initialQuad) return;
      const wrapper = shadow.getElementById('canvas-wrapper') || shadow.getElementById('canvas-viewport');
      const rect = wrapper?.getBoundingClientRect() || { width: 300, height: 400 };

      const dx = (e.clientX - startX) / Math.max(rect.width, 1);
      const dy = (e.clientY - startY) / Math.max(rect.height, 1);

      const nextQuad = cloneQuad(initialQuad);
      const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

      if (isDraggingQuad) {
        let minDx = -Infinity;
        let maxDx = Infinity;
        let minDy = -Infinity;
        let maxDy = Infinity;
        for (const k of keys) {
          minDx = Math.max(minDx, -initialQuad[k].x);
          maxDx = Math.min(maxDx, 1 - initialQuad[k].x);
          minDy = Math.max(minDy, -initialQuad[k].y);
          maxDy = Math.min(maxDy, 1 - initialQuad[k].y);
        }
        const clampedDx = Math.min(Math.max(dx, minDx), maxDx);
        const clampedDy = Math.min(Math.max(dy, minDy), maxDy);
        for (const k of keys) {
          nextQuad[k].x = initialQuad[k].x + clampedDx;
          nextQuad[k].y = initialQuad[k].y + clampedDy;
        }
      } else if (activeCorner && nextQuad[activeCorner]) {
        const nx = Math.min(Math.max(0, initialQuad[activeCorner].x + dx), 1);
        const ny = Math.min(Math.max(0, initialQuad[activeCorner].y + dy), 1);
        nextQuad[activeCorner].x = nx;
        nextQuad[activeCorner].y = ny;
        updateMagnifier(nx, ny);
      }

      this.#draftQuad = nextQuad;
      this.#updateCropBoxUi();
    };

    const onPointerUp = () => {
      activeCorner = null;
      isDraggingQuad = false;
      initialQuad = null;
      hideMagnifier();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    quadOutline.addEventListener('pointerdown', onPointerDown);
    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', onPointerDown);
    });
  }

  #updateCropBoxUi() {
    const shadow = this.shadowRoot;
    if (!shadow || !this.#draftQuad) return;

    const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = this.#draftQuad;
    const p = (pt) => `${(pt.x * 100).toFixed(2)},${(pt.y * 100).toFixed(2)}`;
    const ptsStr = `${p(tl)} ${p(tr)} ${p(br)} ${p(bl)}`;

    const mask = shadow.getElementById('crop-quad-mask');
    if (mask) {
      mask.setAttribute(
        'd',
        `M0,0 H100 V100 H0 Z M${(tl.x * 100).toFixed(2)},${(tl.y * 100).toFixed(2)} L${(tr.x * 100).toFixed(2)},${(tr.y * 100).toFixed(2)} L${(br.x * 100).toFixed(2)},${(br.y * 100).toFixed(2)} L${(bl.x * 100).toFixed(2)},${(bl.y * 100).toFixed(2)} Z`,
      );
    }

    const outline = shadow.getElementById('crop-quad-outline');
    if (outline) {
      outline.setAttribute('points', ptsStr);
    }

    // Perspective rule-of-thirds grid lines
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const setLine = (id, a, b) => {
      const el = shadow.getElementById(id);
      if (!el) return;
      el.setAttribute('x1', (a.x * 100).toFixed(2));
      el.setAttribute('y1', (a.y * 100).toFixed(2));
      el.setAttribute('x2', (b.x * 100).toFixed(2));
      el.setAttribute('y2', (b.y * 100).toFixed(2));
    };
    setLine('crop-grid-v1', lerp(tl, tr, 1 / 3), lerp(bl, br, 1 / 3));
    setLine('crop-grid-v2', lerp(tl, tr, 2 / 3), lerp(bl, br, 2 / 3));
    setLine('crop-grid-h1', lerp(tl, bl, 1 / 3), lerp(tr, br, 1 / 3));
    setLine('crop-grid-h2', lerp(tl, bl, 2 / 3), lerp(tr, br, 2 / 3));

    const corners = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
    for (const [corner, pt] of Object.entries(corners)) {
      const handle = shadow.querySelector(`.copio-quad-handle[data-corner="${corner}"]`);
      if (handle) {
        /** @type {HTMLElement} */ (handle).style.left = `${(pt.x * 100).toFixed(2)}%`;
        /** @type {HTMLElement} */ (handle).style.top = `${(pt.y * 100).toFixed(2)}%`;
      }
    }
  }

  async #syncView() {
    if (!this.shadowRoot) return;
    if (this.#renderPromise) {
      return this.#renderPromise;
    }
    this.#renderPromise = (async () => {
      try {
        await Promise.resolve();
        await this.#doSyncView();
      } finally {
        this.#renderPromise = null;
      }
    })();
    return this.#renderPromise;
  }

  async #doSyncView() {
    if (!this.shadowRoot) return;

    try {
      const pages = await this.getPages();
      this.#pageCount = pages.length;
      const shadow = this.shadowRoot;

      // Update badge, title, subtitle
      const modeBadge = shadow.getElementById('mode-badge');
      if (modeBadge) {
        modeBadge.textContent = (this.mode || 'single').toUpperCase();
      }

      // Update tabs
      const tabViewfinder = shadow.getElementById('tab-viewfinder');
      const tabWorkbench = shadow.getElementById('tab-workbench');
      if (tabViewfinder) tabViewfinder.setAttribute('aria-selected', String(this.#stage === 'viewfinder'));
      if (tabWorkbench) tabWorkbench.setAttribute('aria-selected', String(this.#stage === 'workbench'));

      // Viewfinder vs Workbench display
      const vfSection = shadow.getElementById('viewfinder-section');
      const wbSection = shadow.getElementById('workbench-section');
      if (vfSection && wbSection) {
        if (this.#stage === 'viewfinder') {
          vfSection.style.display = 'flex';
          wbSection.style.display = 'none';
        } else {
          vfSection.style.display = 'none';
          wbSection.style.display = 'flex';
        }
      }

      // Update aspect attribute on framing guide
      const guide = shadow.getElementById('framing-guide');
      if (guide) {
        guide.setAttribute('data-aspect', this.aspect || 'auto');
      }

      // Step pill text in viewfinder
      const stepPillText = shadow.getElementById('step-pill-text');
      if (stepPillText) {
        if (this.#cameraStream) {
          stepPillText.textContent = this.mode === 'batch'
            ? `Batch Capture · Page ${pages.length + 1}`
            : 'Camera Active · Tap Shutter to Snap';
        } else if (this.aspect === 'card' && this.maxPages === 2) {
          stepPillText.textContent = pages.length === 0
            ? 'Step 1 of 2: Capture Front of ID Card'
            : 'Step 2 of 2: Capture Back of ID Card';
        } else if (this.aspect === 'card') {
          stepPillText.textContent = 'Align Card Inside Frame';
        } else if (this.mode === 'batch') {
          stepPillText.textContent = `Batch Capture · Page ${pages.length + 1}`;
        } else {
          stepPillText.textContent = 'Align Document Inside Frame';
        }
      }

      // OCR toolbar button visibility
      const btnOcr = shadow.getElementById('btn-ocr');
      if (btnOcr) {
        btnOcr.style.display = this.ocrEnabled && this.hasFeature('ocr') ? '' : 'none';
      }

      // Review pill in shutter dock
      const reviewBtn = shadow.getElementById('btn-review');
      const reviewText = shadow.getElementById('review-pill-text');
      if (reviewBtn && reviewText) {
        if (pages.length > 0) {
          reviewBtn.style.display = 'inline-flex';
          reviewText.textContent = `Review (${pages.length}) →`;
        } else {
          reviewBtn.style.display = 'none';
        }
      }

      // Workbench view sync
      if (pages.length === 0) {
        if (this.#stage === 'workbench') {
          this.stage = 'viewfinder';
        }
        return;
      }

      if (this.#activePageIndex >= pages.length) {
        this.#activePageIndex = Math.max(0, pages.length - 1);
      }
      const activePage = pages[this.#activePageIndex];

      // Card side switcher visibility
      const cardSwitcher = shadow.getElementById('card-side-switcher');
      if (cardSwitcher) {
        const isCardGuided = this.aspect === 'card' && this.maxPages === 2;
        cardSwitcher.style.display = isCardGuided ? 'flex' : 'none';
        const btnFront = shadow.getElementById('btn-card-front');
        const btnBack = shadow.getElementById('btn-card-back');
        if (btnFront) {
          btnFront.classList.toggle('active', this.#activePageIndex === 0);
          btnFront.setAttribute('aria-selected', String(this.#activePageIndex === 0));
        }
        if (btnBack) {
          btnBack.classList.toggle('active', this.#activePageIndex === 1);
          btnBack.setAttribute('aria-selected', String(this.#activePageIndex === 1));
        }
      }

      // Viewport container state
      const viewport = shadow.getElementById('canvas-viewport');
      if (viewport) {
        viewport.classList.toggle('is-cropping', this.#cropMode);
      }

      // Image in viewport: in crop mode show uncropped original with active rotation and filter (WYSIWYG)
      const stageImg = /** @type {HTMLImageElement|null} */ (shadow.getElementById('stage-img'));
      if (stageImg) {
        if (this.#cropMode) {
          const rot = activePage.edits?.rotate || 0;
          const filter = activePage.edits?.filter || 'none';
          const originalSrc = activePage.originalSrc || activePage.src || '';
          if (rot !== 0 || filter !== 'none') {
            const preview = this.#engine
              ? await this.#engine.renderEdits(originalSrc, { rotate: rot, filter })
              : originalSrc;
            stageImg.src = preview || originalSrc;
          } else {
            stageImg.src = originalSrc;
          }
        } else {
          stageImg.src = activePage.src || activePage.originalSrc || '';
        }
      }

      let cropLayer = shadow.getElementById('crop-layer');
      if (this.#cropMode) {
        if (!cropLayer) {
          const wrapper = shadow.getElementById('canvas-wrapper');
          cropLayer = document.createElement('div');
          cropLayer.className = 'copio-crop-layer';
          cropLayer.id = 'crop-layer';
          cropLayer.innerHTML = `
            <svg class="copio-crop-quad-svg" id="crop-quad-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path class="copio-crop-mask" id="crop-quad-mask" fill-rule="evenodd" d=""></path>
              <line class="copio-crop-quad-grid" id="crop-grid-v1"></line>
              <line class="copio-crop-quad-grid" id="crop-grid-v2"></line>
              <line class="copio-crop-quad-grid" id="crop-grid-h1"></line>
              <line class="copio-crop-quad-grid" id="crop-grid-h2"></line>
              <polygon class="copio-crop-quad-outline" id="crop-quad-outline" points=""></polygon>
            </svg>
            <span class="copio-crop-handle copio-quad-handle" data-corner="topLeft" data-handle="nw"></span>
            <span class="copio-crop-handle copio-quad-handle" data-corner="topRight" data-handle="ne"></span>
            <span class="copio-crop-handle copio-quad-handle" data-corner="bottomRight" data-handle="se"></span>
            <span class="copio-crop-handle copio-quad-handle" data-corner="bottomLeft" data-handle="sw"></span>
            <canvas class="copio-crop-magnifier" id="crop-magnifier" width="96" height="96"></canvas>
          `;
          wrapper?.appendChild(cropLayer);
          this.#bindCropHandles();
        }
        cropLayer.style.display = 'block';
        const rot = activePage.edits?.rotate || 0;
        const priorQuad =
          activePage.edits?.quad ||
          (activePage.edits?.crop ? cropRectToQuad(activePage.edits.crop) : null) || {
            topLeft: { x: 0.05, y: 0.05 },
            topRight: { x: 0.95, y: 0.05 },
            bottomRight: { x: 0.95, y: 0.95 },
            bottomLeft: { x: 0.05, y: 0.95 },
          };
        this.#draftQuad = quadOriginalToRotated(priorQuad, rot);
        this.#updateCropBoxUi();
      } else if (cropLayer) {
        cropLayer.remove();
      }

      // Crop button text
      const cropBtnLabel = shadow.getElementById('crop-btn-label');
      if (cropBtnLabel) {
        cropBtnLabel.textContent = this.#cropMode ? 'Apply' : 'Crop';
      }

      // Primary CTA label
      const primaryCta = shadow.getElementById('btn-primary-complete');
      if (primaryCta) {
        if (this.isHandoff) {
          if (this.aspect === 'card' && this.maxPages === 2 && pages.length === 1) {
            primaryCta.textContent = 'Next: Capture Back (Step 2/2) →';
          } else if (this.aspect === 'card' && pages.length >= 2) {
            primaryCta.textContent = '↑ Send ID Card to Computer (2 Sides)';
          } else if (this.mode === 'batch') {
            primaryCta.textContent = `↑ Send ${pages.length} Pages to Computer`;
          } else {
            primaryCta.textContent = '↑ Send to Computer';
          }
        } else if (this.aspect === 'card' && this.maxPages === 2 && pages.length === 1) {
          primaryCta.textContent = 'Next: Capture Back (Step 2/2) →';
        } else if (this.aspect === 'card' && pages.length >= 2) {
          primaryCta.textContent = '✓ Complete ID Scan (2 Sides)';
        } else if (this.mode === 'batch') {
          primaryCta.textContent = `✓ Complete Scan (${pages.length} Pages)`;
        } else {
          primaryCta.textContent = '✓ Use Photo';
        }
      }

      // Handoff DOM sync
      this.#syncHandoffDom();

      // Filmstrip rendering
      this.#renderFilmstrip(pages);
    } catch {
      // Ignore background render errors during teardown
    }
  }

  #renderFilmstrip(pages) {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const scrollContainer = shadow.getElementById('filmstrip-scroll');
    if (!scrollContainer) return;

    scrollContainer.innerHTML = '';
    pages.forEach((page, idx) => {
      const item = document.createElement('div');
      item.className = `copio-filmstrip-item ${idx === this.#activePageIndex ? 'is-active' : ''}`;
      item.setAttribute('data-index', String(idx));

      item.innerHTML = `
        <div class="copio-thumb-container">
          <img src="${page.src || page.originalSrc}" alt="Page ${idx + 1}" class="copio-thumb-img" />
          <span class="copio-thumb-num">${idx + 1}</span>
        </div>
        ${this.mode === 'batch' ? `
          <div class="copio-thumb-reorder">
            <button type="button" class="copio-reorder-btn move-left" title="Move Left" ${idx === 0 ? 'disabled' : ''}>◀</button>
            <button type="button" class="copio-reorder-btn move-right" title="Move Right" ${idx === pages.length - 1 ? 'disabled' : ''}>▶</button>
          </div>
        ` : ''}
      `;

      item.querySelector('.copio-thumb-container')?.addEventListener('click', () => {
        this.#activePageIndex = idx;
        this.#cropMode = false;
        this.#syncView();
      });

      if (this.mode === 'batch') {
        item.querySelector('.move-left')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.#movePage(idx, idx - 1);
        });
        item.querySelector('.move-right')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.#movePage(idx, idx + 1);
        });
      }

      scrollContainer.appendChild(item);
    });
  }

  async #movePage(fromIdx, toIdx) {
    const pages = await this.getPages();
    if (toIdx < 0 || toIdx >= pages.length || fromIdx === toIdx) return;

    const pageIds = pages.map((p) => p.id);
    const [moved] = pageIds.splice(fromIdx, 1);
    pageIds.splice(toIdx, 0, moved);

    await this.#engine.reorderPages(this.#targetDocId, pageIds);
    this.#activePageIndex = toIdx;
    this.#syncView();
  }

  #showToast(message, variant = 'warning', duration = 4000) {
    try {
      if (typeof notify !== 'undefined') {
        const container = this.shadowRoot?.querySelector('.copio-scanner-container') || this;
        if (variant === 'warning' && typeof notify.warning === 'function') {
          notify.warning(message, { container });
        } else if (typeof notify.info === 'function') {
          notify.info(message, { container });
        }
      }
    } catch {}

    const shadow = this.shadowRoot;
    const toastRegion = shadow?.getElementById('toast-region');
    if (!toastRegion) return;

    const toastEl = document.createElement('div');
    toastEl.className = `copio-toast copio-toast-${variant}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `<span class="copio-toast-msg">${message}</span>`;
    toastRegion.appendChild(toastEl);

    setTimeout(() => {
      toastEl.classList.add('copio-toast-fade-out');
      setTimeout(() => {
        toastEl.remove();
      }, 250);
    }, duration);
  }

  #handleCameraFailure(error, message) {
    const isDenied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
    const code = isDenied ? 'CAMERA_PERMISSION_DENIED' : 'CAMERA_UNAVAILABLE';

    this.#showToast(message, 'warning');

    const stepPillText = this.shadowRoot?.getElementById('step-pill-text');
    if (stepPillText) {
      stepPillText.textContent = 'Camera Unavailable · Select File';
    }

    this.dispatch(COPIO_EVENTS.ERROR, {
      code,
      message,
      error,
    });

    const fileInput = this.shadowRoot?.getElementById('internal-file-input');
    if (fileInput && typeof fileInput.click === 'function') {
      fileInput.click();
    }
  }

  #stopCameraStream() {
    this.#stopLiveEdgeDetection();
    this.#hideLiveQuadOverlay();
    if (this.#cameraStream) {
      try {
        const tracks = this.#cameraStream.getTracks();
        for (const track of tracks) {
          track.stop();
        }
      } catch {}
      this.#cameraStream = null;
    }
    const shadow = this.shadowRoot;
    const videoEl = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));
    if (videoEl) {
      try {
        videoEl.pause();
      } catch {}
      videoEl.srcObject = null;
      videoEl.style.display = 'none';
    }
    const placeholder = shadow?.querySelector('.copio-camera-placeholder');
    if (placeholder) {
      /** @type {HTMLElement} */ (placeholder).style.display = '';
    }
    const stepPillText = shadow?.getElementById('step-pill-text');
    if (stepPillText && this.#stage === 'viewfinder') {
      stepPillText.textContent = this.mode === 'batch'
        ? `Batch Capture · Page ${this.#pageCount + 1}`
        : 'Align Document Inside Frame';
    }
  }

  async startCamera(options = {}) {
    const shadow = this.shadowRoot;
    const videoEl = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));
    if (!videoEl) return null;

    if (this.#cameraStream) {
      return this.#cameraStream;
    }

    const isAutomatedTest =
      typeof window !== 'undefined' &&
      /** @type {any} */ (window).__WTR_CONFIG__ !== undefined &&
      typeof navigator !== 'undefined' &&
      navigator.webdriver === true &&
      !options.force;
    if (isAutomatedTest) {
      return null;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.#handleCameraFailure(new Error('NO_CAMERA_SUPPORT'), 'No camera found. Choose a photo from your files instead.');
      return null;
    }

    const constraintTiers = [
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      },
      {
        video: {
          width: { ideal: 1280 },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let stream = null;
    let lastError = null;

    for (const constraints of constraintTiers) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    if (!stream) {
      const isDenied = lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError';
      const msg = isDenied
        ? 'Camera permission denied. Choose a photo from your files instead.'
        : 'Camera unavailable. Choose a photo from your files instead.';
      this.#handleCameraFailure(lastError || new Error('CAMERA_UNAVAILABLE'), msg);
      return null;
    }

    this.setCameraStream(stream);
    return stream;
  }

  stopCamera() {
    this.#stopCameraStream();
  }

  /**
   * Internal hook for auto edge detection (CPO-074 / CPO-076).
   * Grabs the current frame from the active camera video element as an ImageData or Canvas.
   * Not exposed in the stable public API docs.
   *
   * @param {Object} [options]
   * @param {number} [options.maxWidth=640] - Downscale max width for lightweight processing
   * @param {number} [options.maxHeight=480] - Downscale max height for lightweight processing
   * @param {'imageData'|'canvas'} [options.format='imageData']
   * @returns {ImageData|HTMLCanvasElement|null}
   */
  _grabFrame(options = {}) {
    const shadow = this.shadowRoot;
    const videoEl = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));
    if (!this.#cameraStream || !videoEl) {
      return null;
    }

    const srcW = videoEl.videoWidth || 640;
    const srcH = videoEl.videoHeight || 480;
    if (srcW === 0 || srcH === 0) return null;

    const maxWidth = options.maxWidth || 640;
    const maxHeight = options.maxHeight || 480;
    const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    if (!this.#grabCanvas && typeof document !== 'undefined') {
      this.#grabCanvas = document.createElement('canvas');
    }
    if (!this.#grabCanvas) return null;

    this.#grabCanvas.width = targetW;
    this.#grabCanvas.height = targetH;
    const ctx = this.#grabCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    try {
      ctx.drawImage(videoEl, 0, 0, targetW, targetH);
    } catch {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, targetW, targetH);
    }
    if (options.format === 'canvas') {
      return this.#grabCanvas;
    }
    return ctx.getImageData(0, 0, targetW, targetH);
  }

  /**
   * Internal inspection helper for test suites and adapter readiness.
   * @returns {boolean}
   */
  _isCameraActive() {
    return Boolean(this.#cameraStream);
  }

  #startLiveEdgeDetection() {
    this.#stopLiveEdgeDetection();
    if (!this.#edgeDetection || !this.#cameraStream || this.#stage !== 'viewfinder') {
      return;
    }

    const loop = async (timestamp) => {
      if (!this.#cameraStream || this.#stage !== 'viewfinder' || !this.#edgeDetection) {
        this.#stopLiveEdgeDetection();
        return;
      }

      const elapsed = timestamp - this.#lastEdgeDetectTime;
      if (!this.#isDetectingEdge && elapsed >= 35) {
        this.#lastEdgeDetectTime = timestamp;
        await this.#processLiveViewfinderFrame(timestamp);
      }

      if (this.#cameraStream && this.#stage === 'viewfinder' && this.#edgeDetection) {
        this.#liveEdgeRafId = requestAnimationFrame(loop);
      }
    };

    this.#liveEdgeRafId = requestAnimationFrame(loop);
  }

  #stopLiveEdgeDetection() {
    if (this.#liveEdgeRafId !== null) {
      cancelAnimationFrame(this.#liveEdgeRafId);
      this.#liveEdgeRafId = null;
    }
    this.#isDetectingEdge = false;
  }

  #hideLiveQuadOverlay() {
    const shadow = this.shadowRoot;
    const svg = shadow?.getElementById('live-quad-overlay');
    if (svg) {
      svg.style.display = 'none';
    }
    const feed = shadow?.getElementById('camera-feed');
    if (feed) {
      feed.classList.remove('is-detected', 'is-tracking');
    }
    const polygon = shadow?.getElementById('live-quad-polygon');
    if (polygon) {
      polygon.setAttribute('points', '');
    }
    for (let i = 0; i < 4; i++) {
      const c = shadow?.getElementById(`live-quad-c${i}`);
      if (c) {
        c.removeAttribute('cx');
        c.removeAttribute('cy');
      }
    }
    this.#smoothedQuad = null;
    this.#latestDetectionResult = null;
    this.#consecutiveMisses = 0;
    this.#stableQuadStartTime = 0;
    this.#lastStableQuad = null;
  }

  #renderLiveQuadOverlay(quad, confidence) {
    const shadow = this.shadowRoot;
    const svg = shadow?.getElementById('live-quad-overlay');
    const feed = shadow?.getElementById('camera-feed');
    const v = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));
    if (!svg || !feed || !quad) return;
    const fW = feed.clientWidth, fH = feed.clientHeight;
    if (fW <= 0 || fH <= 0) return;
    const vW = v?.videoWidth || 640, vH = v?.videoHeight || 480;
    const s = Math.max(fW / vW, fH / vH), rW = vW * s, rH = vH * s;
    const ox = (fW - rW) / 2, oy = (fH - rH) / 2;
    const corners = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
    const pts = corners.map(
      (p) => `${(ox + p.x * rW).toFixed(1)},${(oy + p.y * rH).toFixed(1)}`
    );
    svg.setAttribute('viewBox', `0 0 ${fW} ${fH}`);
    svg.style.display = 'block';
    shadow.getElementById('live-quad-polygon')?.setAttribute('points', pts.join(' '));
    for (let i = 0; i < 4; i++) {
      const c = shadow.getElementById(`live-quad-c${i}`);
      if (c) {
        c.setAttribute('cx', (ox + corners[i].x * rW).toFixed(1));
        c.setAttribute('cy', (oy + corners[i].y * rH).toFixed(1));
      }
    }
    feed.classList.add('is-tracking');
    feed.classList.toggle('is-detected', confidence >= 0.70);
  }

  async #processLiveViewfinderFrame(timestamp) {
    const shadow = this.shadowRoot;
    const videoEl = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;

    const frame = this._grabFrame({ maxWidth: 480, maxHeight: 480 });
    if (!frame) return;

    this.#isDetectingEdge = true;
    try {
      const edgeService = this.#engine?.getService('edge') || getRegisteredService('edge');
      if (!edgeService || typeof edgeService.detect !== 'function') return;

      const minConfidence = this.#edgeModel === 'ml' ? 0.40 : 0.45;
      const result = await edgeService.detect(frame, {
        maxProcessingDimension: 480,
        enableDetectionCascade: false,
        minConfidence,
        fallbackOnLowConfidence: false,
        detector: this.#edgeModel,
        ml: { minScore: minConfidence },
      });

      if (!this.#cameraStream || this.#stage !== 'viewfinder' || !this.#edgeDetection) return;

      if (result && result.quad && result.confidence >= minConfidence && !result.isFallback) {
        this.#consecutiveMisses = 0;
        const alpha = 0.35;
        if (!this.#smoothedQuad) {
          this.#smoothedQuad = cloneQuad(result.quad);
        } else {
          for (const k of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
            this.#smoothedQuad[k].x = alpha * result.quad[k].x + (1 - alpha) * this.#smoothedQuad[k].x;
            this.#smoothedQuad[k].y = alpha * result.quad[k].y + (1 - alpha) * this.#smoothedQuad[k].y;
          }
        }

        this.#latestDetectionResult = {
          quad: cloneQuad(this.#smoothedQuad),
          confidence: result.confidence,
          durationMs: result.durationMs,
          isFallback: false,
        };

        this.#renderLiveQuadOverlay(this.#smoothedQuad, result.confidence);

        this.dispatch(COPIO_EVENTS.EDGE_DETECTED, {
          quad: cloneQuad(this.#smoothedQuad),
          confidence: result.confidence,
          durationMs: result.durationMs,
        });

        if (this.#autoCapture && result.confidence >= 0.65) {
          this.#checkSmartShutter(this.#smoothedQuad, timestamp);
        }
      } else {
        this.#consecutiveMisses++;
        if (this.#consecutiveMisses > 4) {
          this.#smoothedQuad = null;
          this.#latestDetectionResult = null;
          this.#stableQuadStartTime = 0;
          this.#hideLiveQuadOverlay();
        }
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[CopioScanner] Live edge detection error:', err);
      }
    } finally {
      this.#isDetectingEdge = false;
    }
  }

  #checkSmartShutter(quad, timestamp) {
    if (!this.#autoCapture || !quad) return;
    const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    area = Math.abs(area) / 2;
    if (area < 0.15) {
      this.#stableQuadStartTime = 0;
      this.#lastStableQuad = null;
      return;
    }

    if (!this.#lastStableQuad) {
      this.#lastStableQuad = cloneQuad(quad);
      this.#stableQuadStartTime = timestamp;
      return;
    }

    let sumSq = 0;
    for (const k of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
      const dx = quad[k].x - this.#lastStableQuad[k].x;
      const dy = quad[k].y - this.#lastStableQuad[k].y;
      sumSq += dx * dx + dy * dy;
    }
    const rmsJitter = Math.sqrt(sumSq / 4);
    this.#lastStableQuad = cloneQuad(quad);

    if (rmsJitter < 0.015) {
      if (timestamp - this.#stableQuadStartTime >= 600) {
        this.#stableQuadStartTime = timestamp + 10000; // Cooldown
        this.#handleShutterClick();
      }
    } else {
      this.#stableQuadStartTime = timestamp;
    }
  }

  async #handleShutterClick() {
    if (typeof this.onShutter === 'function') {
      const handled = await this.onShutter();
      if (handled !== false) return;
    }

    const shadow = this.shadowRoot;
    const videoEl = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));

    // If camera stream is already active, capture a frame from the video element
    if (this.#cameraStream && videoEl) {
      const cameraFeed = shadow?.getElementById('camera-feed');
      if (cameraFeed) {
        cameraFeed.classList.remove('is-shutter-flash');
        void cameraFeed.offsetWidth;
        cameraFeed.classList.add('is-shutter-flash');
      }

      // Cache current live tracked quad at snapshot time
      const minConfidence = this.#edgeModel === 'ml' ? 0.40 : 0.45;
      const captureQuad = this.#latestDetectionResult?.confidence >= minConfidence
        ? cloneQuad(this.#latestDetectionResult.quad)
        : null;

      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth || 1280;
      canvas.height = videoEl.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        } catch {
          ctx.fillStyle = '#334155';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        canvas.width = 0;
        canvas.height = 0;

        if (blob) {
          const isBatch = this.mode === 'batch';
          if (!isBatch) {
            this.#stopCameraStream();
          }

          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          await this.addFiles([file], { prefilledQuad: captureQuad });

          if (isBatch && this.maxPages > 0 && this.#pageCount >= this.maxPages) {
            this.#stopCameraStream();
            this.stage = 'workbench';
          }
          return;
        }
      }
    }

    // Try opening live MediaDevices camera stream
    const stream = await this.startCamera();
    if (stream) {
      return;
    }

    const fileInput = shadow?.getElementById('internal-file-input');
    if (fileInput && typeof fileInput.click === 'function') {
      fileInput.click();
    }
  }

  async #rotateActivePage() {
    const pages = await this.getPages();
    const activePage = pages[this.#activePageIndex];
    if (!activePage) return;

    if (this.#cropMode) {
      this.#cropMode = false;
      this.#draftQuad = null;
    }

    const currentRotate = activePage.edits?.rotate || 0;
    const newRotate = (currentRotate + 90) % 360;

    await this.#engine.applyEdit(this.#targetDocId, activePage.id, {
      rotate: newRotate,
    });
    await this.#syncView();
  }

  async #toggleActivePageBw() {
    const pages = await this.getPages();
    const activePage = pages[this.#activePageIndex];
    if (!activePage) return;

    if (this.#cropMode) {
      this.#cropMode = false;
      this.#draftQuad = null;
    }

    const currentFilter = activePage.edits?.filter || 'none';
    const newFilter = currentFilter === 'bw' ? 'none' : 'bw';

    await this.#engine.applyEdit(this.#targetDocId, activePage.id, {
      filter: newFilter,
    });
    await this.#syncView();
  }

  async #toggleCropMode() {
    const pages = await this.getPages();
    const activePage = pages[this.#activePageIndex];
    if (!activePage) return;

    if (this.#cropMode) {
      this.#cropMode = false;
      const draftQuad = this.#draftQuad;
      this.#draftQuad = null;
      if (draftQuad) {
        const rot = activePage.edits?.rotate || 0;
        const originalQuad = quadRotatedToOriginal(draftQuad, rot);
        const originalCrop = quadToCropRect(originalQuad);
        await this.#engine.applyEdit(this.#targetDocId, activePage.id, {
          quad: originalQuad,
          crop: originalCrop,
        });
      }
    } else {
      this.#cropMode = true;
    }
    await this.#syncView();
  }

  async #deleteActivePageWithUndo() {
    const pages = await this.getPages();
    const activePage = pages[this.#activePageIndex];
    if (!activePage) return;

    const deletedPageId = activePage.id;
    await this.#engine.deletePage(this.#targetDocId, deletedPageId);

    this.dispatch(COPIO_EVENTS.PAGE_REMOVED, {
      pageId: deletedPageId,
      docId: this.docId,
    });

    if (this.#activePageIndex >= pages.length - 1) {
      this.#activePageIndex = Math.max(0, pages.length - 2);
    }

    this.#showUndoToast();
    await this.#syncView();
  }

  #showUndoToast() {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const toastRegion = shadow.getElementById('toast-region');
    if (!toastRegion) return;

    if (this.#undoTimer) {
      clearInterval(this.#undoTimer);
    }

    this.#undoRemaining = 5;
    const renderToast = () => {
      toastRegion.innerHTML = `
        <div class="copio-toast copio-toast-undo">
          <span>Page deleted</span>
          <button type="button" class="copio-btn-toast-undo" id="btn-toast-undo">
            Undo (${this.#undoRemaining}s)
          </button>
        </div>
      `;

      shadow.getElementById('btn-toast-undo')?.addEventListener('click', async () => {
        clearInterval(this.#undoTimer);
        this.#undoTimer = null;
        toastRegion.innerHTML = '';
        await this.#engine.undo(this.#targetDocId);
        await this.#syncView();
      });
    };

    renderToast();
    this.#undoTimer = setInterval(() => {
      this.#undoRemaining -= 1;
      if (this.#undoRemaining <= 0) {
        clearInterval(this.#undoTimer);
        this.#undoTimer = null;
        toastRegion.innerHTML = '';
      } else {
        renderToast();
      }
    }, 1000);
  }

  async #openOcrSheet() {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const sheet = shadow.getElementById('ocr-sheet');
    const body = shadow.getElementById('ocr-body');
    if (!sheet || !body) return;

    sheet.style.display = 'block';
    body.innerHTML = `<p class="copio-ocr-loading">Recognizing text...</p>`;

    try {
      const pages = await this.getPages();
      const activePage = pages[this.#activePageIndex];
      const result = await this.ocr(activePage?.id || null);

      const rawConf = result.averageConfidence || 0;
      const confPct = rawConf <= 1 && rawConf > 0 ? Math.round(rawConf * 100) : Math.round(rawConf);

      body.innerHTML = `
        <div class="copio-ocr-content">
          <pre class="copio-ocr-text">${result.text || 'No text detected.'}</pre>
          <div class="copio-ocr-meta">
            <span>Confidence: ${confPct}%</span>
          </div>
        </div>
      `;
    } catch (err) {
      body.innerHTML = `<p class="copio-ocr-error">OCR recognition failed: ${err.message}</p>`;
    }
  }

  #closeOcrSheet() {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const sheet = shadow.getElementById('ocr-sheet');
    if (sheet) sheet.style.display = 'none';
  }

  async #handlePrimaryCtaClick() {
    if (this.aspect === 'card' && this.maxPages === 2 && this.#pageCount === 1) {
      this.stage = 'viewfinder';
      return;
    }

    const pages = await this.getPages();

    // Guided 2-step card mode: if on step 1, advance to viewfinder for step 2
    if (this.aspect === 'card' && this.maxPages === 2 && pages.length === 1) {
      this.stage = 'viewfinder';
      return;
    }

    // Complete scan and emit unified copio:scan-complete
    const summarizedPages = pages.map((p, idx) => ({
      id: p.id,
      pageNumber: idx + 1,
      label: p.label || `Page ${idx + 1}`,
      originalSrc: p.originalSrc,
      src: p.src,
      originalPreserved: true,
      dimensions: { width: p.width || 0, height: p.height || 0 },
      edits: p.edits || { crop: { x: 0, y: 0, w: 1, h: 1 }, rotate: 0, filter: 'none' },
      ocrText: p.ocrText || null,
      blob: p.blob || null,
    }));

    const payload = {
      mode: this.mode,
      aspect: this.aspect,
      docId: this.docId,
      pageCount: summarizedPages.length,
      pages: summarizedPages,
    };

    if (this.mode === 'single') {
      payload.page = summarizedPages[0] || null;
      if (this.maxPages > 1) {
        payload.maxPages = this.maxPages;
      }
    }

    // If mobile handoff sender mode is active, stream pages over HandoffSession
    if (this.isHandoff && this.#handoffSession) {
      await this.#streamHandoffPages(summarizedPages, payload);
      return;
    }

    this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, payload);
  }

  async completeScan() {
    return this.#handlePrimaryCtaClick();
  }

  // --- Configuration Properties (CPO-034, CPO-035, CPO-038) ---

  /**
   * @returns {string|null}
   */
  get handoff() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('handoff') : null;
  }

  /**
   * @param {string|boolean|null} val
   */
  set handoff(val) {
    if (typeof this.setAttribute === 'function') {
      if (val != null && (typeof val !== 'boolean' || val === true)) {
        this.setAttribute('handoff', typeof val === 'string' ? val : '');
      } else {
        this.removeAttribute('handoff');
      }
    }
  }

  get isHandoff() {
    return this.#isHandoffMode();
  }

  get handoffSession() {
    return this.#handoffSession;
  }

  get handoffState() {
    return this.#handoffState;
  }

  get handoffProgress() {
    return this.#handoffProgress;
  }

  get handoffRetryCount() {
    return this.#handoffRetryCount;
  }

  /**
   * Attaches an existing HandoffSession (e.g. LoopbackTransport in automated tests).
   * @param {HandoffSession} session
   * @param {Object} [token]
   */
  attachHandoffSession(session, token = null) {
    this.#cleanupHandoff();
    this.#handoffSession = session;
    this.#handoffToken = token || session?.token || null;
    this.#bindHandoffSessionEvents(session);
    this.#handoffState = session.isConnected ? 'connected' : (session.state === 'idle' ? 'connecting' : session.state);
    this.#syncHandoffDom();
  }

  /**
   * Reconnects to desktop host session.
   */
  async reconnectHandoff() {
    if (!this.#handoffSession || !this.#handoffToken) return;
    if (this.#handoffState === 'complete' || this.#handoffState === 'connecting') return;

    this.#handoffRetryCount++;
    this.#handoffState = 'reconnecting';
    this.#syncHandoffDom();

    try {
      if (LoopbackTransport.has(this.#handoffToken.peerId)) {
        const linked = LoopbackTransport.createLinkedSender(this.#handoffToken.peerId);
        await this.#handoffSession.reconnect(linked);
      } else {
        await this.#handoffSession.reconnect();
      }
    } catch (err) {
      console.warn('[CopioScanner] Handoff reconnect failed:', err);
      this.#handoffState = 'disconnected';
      this.#syncHandoffDom(err?.message || 'Reconnection failed');
    }
  }

  /**
   * Resets handoff sender view and confirmation screen to allow scanning more documents.
   */
  async resetHandoff() {
    this.#handoffState = this.#handoffSession?.isConnected ? 'connected' : 'idle';
    this.#handoffProgress = null;
    const shadow = this.shadowRoot;
    if (shadow) {
      const confirmView = shadow.getElementById('handoff-confirm-view');
      if (confirmView) confirmView.style.display = 'none';
      const progressView = shadow.getElementById('handoff-progress-view');
      if (progressView) progressView.style.display = 'none';
    }
    await this.clear();
    this.stage = 'viewfinder';
    this.#syncHandoffDom();
  }

  #isHandoffMode() {
    if (this.#handoffSession) return true;
    if (typeof this.hasAttribute === 'function' && this.hasAttribute('handoff')) {
      return this.getAttribute('handoff') !== 'false';
    }
    if (typeof window !== 'undefined' && window.location?.hash) {
      return /(?:copio-)?handoff=/.test(window.location.hash);
    }
    return false;
  }

  async #initHandoffMode() {
    if (this.#handoffSession) return;
    if (!this.#isHandoffMode()) return;

    let tokenStr = typeof this.getAttribute === 'function' ? this.getAttribute('handoff') : null;
    if (!tokenStr && typeof window !== 'undefined' && window.location?.hash) {
      tokenStr = window.location.hash;
    }
    if (!tokenStr) return;

    try {
      const token = typeof tokenStr === 'string' && tokenStr.includes('#')
        ? parseHandoffUrl(tokenStr)
        : decodeSessionToken(tokenStr);

      this.#handoffToken = token;
      this.#handoffState = 'connecting';
      this.#syncHandoffDom();

      // Check loopback registry first
      let transport = null;
      if (LoopbackTransport.has(token.peerId)) {
        transport = LoopbackTransport.createLinkedSender(token.peerId);
      } else {
        try {
          const { HandoffPeerTransport } = await import('../js/services/handoff-transport.js');
          transport = new HandoffPeerTransport({
            role: 'sender',
            targetPeerId: token.peerId,
            relayUrl: token.relayUrl || this.relayUrl,
            signalingUrl: token.signalingUrl || this.signalingUrl,
            iceServers: token.iceServers || this.iceServers,
            iceTransportPolicy: this.iceTransportPolicy,
          });
        } catch {
          transport = new LoopbackTransport();
        }
      }

      const session = new HandoffSession({
        role: 'sender',
        transport,
      });

      this.#handoffSession = session;
      this.#bindHandoffSessionEvents(session);
      await session.startSender(token);
    } catch (err) {
      console.warn('[CopioScanner] Handoff sender init failed:', err);
      this.#handoffState = 'error';
      this.#syncHandoffDom(err?.message || 'Connection error');
    }
  }

  #bindHandoffSessionEvents(session) {
    this.#handoffUnsubs.push(
      session.on('stateChange', (newState) => {
        if (newState === 'closed') {
          this.#handoffState = 'disconnected';
        } else {
          this.#handoffState = newState;
        }
        if (newState === 'connected') {
          this.#handoffRetryCount = 0;
          this.dispatch(COPIO_EVENTS.HANDOFF_CONNECTED, {
            sessionId: this.#handoffToken?.sessionId || '',
            peerId: this.#handoffToken?.peerId || '',
          });
        }
        this.#syncHandoffDom();
      }),

      session.on('connectionInfo', (info) => {
        this.dispatch(COPIO_EVENTS.CONNECTION_INFO, info);
      }),

      session.on('progress', (progress) => {
        this.#handoffProgress = progress;
        this.#updateHandoffProgressDom(progress);
      }),

      session.on('complete', () => {
        this.#handoffState = 'complete';
        this.#syncHandoffDom();
      }),

      session.on('error', (err) => {
        console.warn('[CopioScanner] Handoff session error:', err);
        this.#handoffState = 'error';
        this.#syncHandoffDom(err?.message || 'Connection error');
      })
    );
  }

  #cleanupHandoff() {
    for (const unsub of this.#handoffUnsubs) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.#handoffUnsubs = [];
    if (this.#handoffSession) {
      try {
        this.#handoffSession.close();
      } catch {
        // ignore
      }
      this.#handoffSession = null;
    }
    this.#handoffToken = null;
    this.#handoffState = 'idle';
    this.#handoffProgress = null;
  }

  #syncHandoffDom(errorMsg = '') {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const pill = shadow.getElementById('handoff-pill');
    const dot = shadow.getElementById('handoff-dot');
    const statusText = shadow.getElementById('handoff-status-text');
    const retryBtn = shadow.getElementById('btn-handoff-retry');

    if (!pill || !dot || !statusText) return;

    if (!this.#isHandoffMode()) {
      pill.style.display = 'none';
      return;
    }

    pill.style.display = 'inline-flex';
    dot.className = `copio-handoff-dot ${this.#handoffState}`;

    const labels = {
      connecting: 'Connecting to computer…',
      connected: 'Paired with computer',
      reconnecting: 'Reconnecting to computer…',
      disconnected: 'Disconnected',
      sending: 'Sending to computer…',
      complete: 'Sent to computer ✓',
      error: errorMsg || 'Connection error',
    };
    statusText.textContent = labels[this.#handoffState] || 'Desktop Handoff';
    if (retryBtn) {
      retryBtn.style.display = (this.#handoffState === 'disconnected' || this.#handoffState === 'error') ? 'inline-block' : 'none';
    }
  }

  #updateHandoffProgressDom(progress) {
    const shadow = this.shadowRoot;
    if (!shadow || !progress) return;
    const bar = shadow.getElementById('handoff-progress-bar');
    const desc = shadow.getElementById('handoff-progress-desc');
    if (bar && typeof progress.percent === 'number') {
      bar.style.width = `${progress.percent}%`;
    }
    if (desc && progress.bytesSent && progress.totalBytes) {
      const sentKb = Math.round(progress.bytesSent / 1024);
      const totalKb = Math.round(progress.totalBytes / 1024);
      desc.textContent = `Streaming chunks: ${sentKb} KB / ${totalKb} KB (${progress.percent}%)`;
    }
  }

  async #streamHandoffPages(pages, payload) {
    const shadow = this.shadowRoot;
    const progressView = shadow?.getElementById('handoff-progress-view');
    const progressBar = shadow?.getElementById('handoff-progress-bar');
    const progressTitle = shadow?.getElementById('handoff-progress-title');
    const progressDesc = shadow?.getElementById('handoff-progress-desc');

    if (progressView) progressView.style.display = 'flex';

    this.#handoffState = 'sending';
    this.#syncHandoffDom();

    try {
      // 1. Stream each page in chunks
      for (let idx = 0; idx < pages.length; idx++) {
        const page = pages[idx];
        if (progressTitle) {
          progressTitle.textContent = pages.length > 1
            ? `Sending page ${idx + 1} of ${pages.length}…`
            : 'Sending page to computer…';
        }
        if (progressDesc) {
          progressDesc.textContent = 'Encrypting with AES-GCM-256…';
        }

        const blob = await this.#ensureBlobForPage(page);

        // Send page with retry on connection drop
        let sent = false;
        let attempts = 0;
        while (!sent && attempts < 3) {
          try {
            if (!this.#handoffSession.isConnected) {
              await this.reconnectHandoff();
              await this.#waitForHandoffConnected(6000);
            }
            await this.#handoffSession.sendPage({
              id: page.id,
              pageIndex: idx,
              mimeType: blob.type || 'image/jpeg',
              blob,
              metadata: {
                width: page.dimensions?.width,
                height: page.dimensions?.height,
                label: page.label,
              },
            });
            sent = true;
          } catch (err) {
            attempts++;
            if (attempts >= 3) throw err;
            await this.reconnectHandoff();
            await this.#waitForHandoffConnected(6000);
          }
        }
      }

      // 2. Complete the session
      if (progressTitle) progressTitle.textContent = 'Finalizing scan session…';
      if (progressBar) progressBar.style.width = '100%';

      await this.#handoffSession.complete({
        docId: payload.docId,
        summary: {
          mode: payload.mode,
          aspect: payload.aspect,
          pageCount: pages.length,
        },
      });

      this.#handoffState = 'complete';
      if (progressView) progressView.style.display = 'none';

      // 3. Show clean confirmation screen (CPO-094)
      const confirmView = shadow?.getElementById('handoff-confirm-view');
      const confirmCount = shadow?.getElementById('handoff-confirm-count');
      if (confirmView) {
        confirmView.style.display = 'flex';
      }
      if (confirmCount) {
        confirmCount.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} transferred to desktop`;
      }
      this.#syncHandoffDom();

      // Dispatch standard scan-complete event matching <copio-scanner>
      this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, payload);
    } catch (err) {
      console.error('[CopioScanner] Handoff streaming error:', err);
      if (progressView) progressView.style.display = 'none';
      this.#handoffState = 'error';
      this.#syncHandoffDom(err.message);
      this.dispatch(COPIO_EVENTS.ERROR, {
        code: 'HANDOFF_STREAMING_FAILED',
        message: err.message,
        error: err,
      });
    }
  }

  async #waitForHandoffConnected(timeoutMs = 6000) {
    if (this.#handoffSession?.isConnected) return;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('Timeout waiting for handoff connection'));
      }, timeoutMs);

      const unsub = this.#handoffSession.on('stateChange', (st) => {
        if (st === 'connected') {
          clearTimeout(timer);
          unsub();
          resolve(undefined);
        }
      });
    });
  }

  async #ensureBlobForPage(page) {
    if (page.blob instanceof Blob) {
      return page.blob;
    }
    const src = page.src || page.originalSrc;
    if (src && typeof fetch === 'function' && (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http'))) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        if (blob && blob.size > 0) return blob;
      } catch {
        // fallback
      }
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = page.dimensions?.width || 120;
      canvas.height = page.dimensions?.height || 160;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg');
      });
    }
    return new Blob([], { type: 'image/jpeg' });
  }

  // --- Configuration Properties (CPO-034, CPO-035, CPO-038) ---

  get theme() {
    return typeof this.getAttribute === 'function'
      ? /** @type {'dark'|'light'|'brand'|'auto'} */ (this.getAttribute('theme') || 'dark')
      : 'dark';
  }

  set theme(val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('theme', val);
      else this.removeAttribute('theme');
    }
  }

  get mode() {
    return typeof this.getAttribute === 'function'
      ? /** @type {'single'|'batch'|'document'} */ (this.getAttribute('mode') || 'document')
      : 'document';
  }

  set mode(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('mode', val);
    }
  }

  get aspect() {
    return typeof this.getAttribute === 'function'
      ? /** @type {'receipt'|'card'|'a4'|'auto'} */ (this.getAttribute('aspect') || 'auto')
      : 'auto';
  }

  set aspect(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('aspect', val);
    }
  }

  get stage() {
    return this.#stage;
  }

  set stage(val) {
    if (val === 'viewfinder' || val === 'workbench') {
      this.#stage = val;
      if (val === 'workbench') {
        this.#stopCameraStream();
      }
      if (typeof this.setAttribute === 'function' && this.getAttribute('stage') !== val) {
        this.setAttribute('stage', val);
      }
      const shadow = this.shadowRoot;
      if (shadow) {
        const vf = shadow.getElementById('viewfinder-section');
        const wb = shadow.getElementById('workbench-section');
        if (vf && wb) {
          vf.style.display = val === 'viewfinder' ? 'flex' : 'none';
          wb.style.display = val === 'workbench' ? 'flex' : 'none';
        }
      }
      this.#syncView();
    }
  }

  get docId() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('doc-id') : null;
  }

  set docId(val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('doc-id', val);
      else this.removeAttribute('doc-id');
    }
  }

  // --- Imperative UI Actions ---

  async rotateActivePage() {
    return this.#rotateActivePage();
  }

  async toggleActivePageBw() {
    return this.#toggleActivePageBw();
  }

  async toggleCropMode() {
    return this.#toggleCropMode();
  }

  async deleteActivePageWithUndo() {
    return this.#deleteActivePageWithUndo();
  }

  setCameraStream(stream) {
    this.#stopCameraStream();
    this.#cameraStream = stream;
    const shadow = this.shadowRoot;
    const videoEl = /** @type {HTMLVideoElement|null} */ (shadow?.getElementById('camera-video'));
    if (videoEl) {
      videoEl.muted = true;
      videoEl.volume = 0;
      videoEl.playsInline = true;
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('webkit-playsinline', '');
      videoEl.setAttribute('muted', '');
      try {
        videoEl.srcObject = (typeof MediaStream !== 'undefined' && stream instanceof MediaStream) ? stream : null;
      } catch {}
      videoEl.style.display = stream ? 'block' : 'none';
      if (stream && videoEl.srcObject) {
        videoEl.play().catch((err) => {
          console.warn('[CopioScanner] Live video element play() error:', err);
        });
      }
    }
    const placeholder = shadow?.querySelector('.copio-camera-placeholder');
    if (placeholder) {
      /** @type {HTMLElement} */ (placeholder).style.display = stream ? 'none' : '';
    }
    const stepPillText = shadow?.getElementById('step-pill-text');
    if (stepPillText && stream) {
      stepPillText.textContent = this.mode === 'batch'
        ? `Batch Capture · Page ${this.#pageCount + 1}`
        : 'Camera Active · Tap Shutter to Snap';
    }
    if (stream && this.#stage === 'viewfinder' && this.#edgeDetection) {
      this.#startLiveEdgeDetection();
    }
  }

  get features() {
    return this.#engine ? this.#engine.features : [];
  }

  set features(val) {
    this.#syncAttr('features', Array.isArray(val) ? val.join(' ') : String(val || ''));
    if (this.#engine) this.#engine.setFeatures(val);
  }

  hasFeature(featureName) {
    return this.#engine ? this.#engine.hasFeature(featureName) : false;
  }

  get ocrEnabled() {
    return this.#engine ? this.#engine.ocr : true;
  }

  set ocrEnabled(val) {
    const enabled = Boolean(val);
    this.#syncAttr('ocr', enabled ? 'true' : 'false');
    if (this.#engine) this.#engine.ocr = enabled;
    this.#updateChildViews();
  }

  get pdf() {
    return this.#engine ? this.#engine.pdf : true;
  }

  set pdf(val) {
    const enabled = Boolean(val);
    this.#syncAttr('pdf', enabled ? 'true' : 'false');
    if (this.#engine) this.#engine.pdf = enabled;
    this.#updateChildViews();
  }

  get exportFormats() {
    return this.#engine ? this.#engine.exportFormats : [];
  }

  set exportFormats(val) {
    this.#syncAttr('export-formats', Array.isArray(val) ? val.join(',') : String(val || ''));
    if (this.#engine) this.#engine.exportFormats = val;
  }

  get ocrLanguages() {
    return this.#engine ? this.#engine.ocrLanguages : [];
  }

  set ocrLanguages(val) {
    this.#syncAttr('ocr-languages', Array.isArray(val) ? val.join(',') : String(val || ''));
    if (this.#engine) this.#engine.ocrLanguages = val;
  }

  get maxPages() {
    return this.#engine ? this.#engine.maxPages : 0;
  }

  set maxPages(val) {
    this.#syncAttr('max-pages', String(val));
    if (this.#engine) this.#engine.maxPages = val;
  }

  get assetBase() {
    return this.#engine ? this.#engine.assetBase : '';
  }

  set assetBase(val) {
    this.#syncAttr('asset-base', String(val || ''));
    if (this.#engine) this.#engine.assetBase = val;
  }

  get licenseKey() {
    return this.#engine ? this.#engine.licenseKey : '';
  }

  set licenseKey(val) {
    this.#syncAttr('license-key', String(val || ''));
    if (this.#engine) this.#engine.licenseKey = val;
  }

  #syncAttr(name, val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute(name, typeof val === 'object' ? JSON.stringify(val) : String(val));
      else this.removeAttribute(name);
    }
  }

  get relayUrl() {
    return this.#engine?.relayUrl || '';
  }

  set relayUrl(val) {
    if (this.#engine) this.#engine.relayUrl = val;
    this.#syncAttr('relay-url', val);
  }

  get signalingUrl() {
    return this.#engine?.signalingUrl || '';
  }

  set signalingUrl(val) {
    if (this.#engine) this.#engine.signalingUrl = val;
    this.#syncAttr('signaling-url', val);
  }

  get iceServers() {
    return this.#engine?.iceServers || null;
  }

  set iceServers(val) {
    if (this.#engine) this.#engine.iceServers = val;
    this.#syncAttr('ice-servers', val);
  }

  get iceTransportPolicy() {
    return this.#engine?.iceTransportPolicy || 'all';
  }

  set iceTransportPolicy(val) {
    if (this.#engine) this.#engine.iceTransportPolicy = val;
    this.#syncAttr('ice-transport-policy', val);
  }

  get storage() {
    return this.#storage;
  }

  set storage(adapter) {
    this.#storage = adapter;
    if (this.#engine) {
      this.#engine.setStorage(adapter);
    }
  }

  get engine() {
    return this.#engine;
  }

  set engine(customEngine) {
    if (customEngine instanceof CopioEngine) {
      this.#engine = customEngine;
      this.#engine.addEventListener(COPIO_EVENTS.MIGRATION, (e) => {
        this.dispatch(COPIO_EVENTS.MIGRATION, e.detail);
      });
    }
  }

  // --- Public Event Dispatcher Helper (CPO-036) ---

  dispatch(eventName, detail = {}) {
    return dispatchCopioEvent(this, eventName, detail);
  }

  // --- Public Methods API (CPO-037) ---

  async open() {
    this.#isOpen = true;
    if (typeof this.focus === 'function') this.focus();
  }

  async close() {
    this.#isOpen = false;
    this.#stopCameraStream();
  }

  get isOpen() {
    return this.#isOpen;
  }

  async capture() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          if (input.files && input.files.length > 0) {
            const added = await this.addFiles([input.files[0]]);
            resolve(added[0] || null);
          } else {
            resolve(null);
          }
        } catch (err) {
          this.dispatch(COPIO_EVENTS.ERROR, {
            code: 'CAPTURE_FAILED',
            message: err.message,
            error: err,
          });
          resolve(null);
        } finally {
          input.remove();
        }
      };

      input.onerror = () => {
        input.remove();
        resolve(null);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  async addFiles(files, options = {}) {
    try {
      const existingPages = await this.getPages();
      let replaceIndex = null;

      if (existingPages.length > 0) {
        if (this.mode === 'single' && this.maxPages <= 1) {
          // Single-page mode: replace the current page when a new file is uploaded/captured
          await this.#engine.clear(this.#targetDocId);
        } else if (this.#retaking || (this.maxPages > 0 && existingPages.length >= this.maxPages)) {
          // Retaking active page or replacing active slot when at maxPages capacity
          const targetIdx = Math.min(this.#activePageIndex, existingPages.length - 1);
          const pageToReplace = existingPages[targetIdx];
          if (pageToReplace) {
            replaceIndex = targetIdx;
            await this.#engine.deletePage(this.#targetDocId, pageToReplace.id);
          }
        }
      }
      this.#retaking = false;

      const engineOpts = {
        autoCrop: this.#autoCrop,
        prefilledQuad: options?.prefilledQuad || null,
        ...options,
      };
      const newPages = await this.#engine.addFiles(files, this.#targetDocId, engineOpts);
      for (let i = 0; i < newPages.length; i++) {
        this.dispatch(COPIO_EVENTS.PAGE_ADDED, {
          page: newPages[i],
          pageNumber: i + 1,
          docId: this.docId,
          source: 'file',
        });
      }

      let allPages = await this.getPages();
      if (replaceIndex !== null && newPages.length === 1 && replaceIndex < allPages.length - 1) {
        const pageIds = allPages.map((p) => p.id);
        const addedId = pageIds.pop();
        if (addedId) {
          pageIds.splice(replaceIndex, 0, addedId);
          await this.#engine.reorderPages(this.#targetDocId, pageIds);
          allPages = await this.getPages();
        }
      }

      this.#pageCount = allPages.length;
      if (newPages.length > 0) {
        this.#activePageIndex = replaceIndex !== null
          ? Math.min(replaceIndex, Math.max(0, allPages.length - 1))
          : Math.max(0, allPages.length - 1);
        if (this.mode === 'single') {
          this.#stage = 'workbench';
          if (typeof this.setAttribute === 'function' && this.getAttribute('stage') !== 'workbench') {
            this.setAttribute('stage', 'workbench');
          }
        }
      }

      this.dispatch(COPIO_EVENTS.PAGES_CHANGED, {
        pages: allPages,
        docId: this.docId,
      });

      if (this.mode === 'single' && newPages.length > 0 && this.maxPages <= 1) {
        this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, {
          mode: this.mode,
          aspect: this.aspect,
          docId: this.docId,
          pages: allPages,
          page: allPages[allPages.length - 1] || null,
          pageCount: allPages.length,
        });
      }

      await this.#syncView();
      return newPages;
    } catch (err) {
      this.dispatch(COPIO_EVENTS.ERROR, {
        code: err.code || 'ADD_FILES_FAILED',
        message: err.message,
        error: err,
      });
      throw err;
    }
  }

  async getPages() {
    return this.#engine.getPages(this.#targetDocId);
  }

  async clear() {
    this.#stopCameraStream();
    this.#activePageIndex = 0;
    this.#pageCount = 0;
    this.#retaking = false;
    this.#cropMode = false;
    await this.#engine.clear(this.#targetDocId);
    this.dispatch(COPIO_EVENTS.PAGES_CHANGED, {
      pages: [],
      docId: this.docId,
    });
    await this.#syncView();
  }

  async exportPdf(opts = {}) {
    try {
      const blob = await this.#engine.exportPdf(this.#targetDocId, opts);
      this.dispatch(COPIO_EVENTS.EXPORT_COMPLETE, {
        type: 'pdf',
        format: 'pdf',
        blob,
        searchable: !!opts.searchable,
        docId: this.docId,
      });
      return blob;
    } catch (err) {
      this.dispatch(COPIO_EVENTS.ERROR, {
        code: err.code || 'EXPORT_FAILED',
        message: err.message,
        error: err,
      });
      throw err;
    }
  }

  async exportZip(opts = {}) {
    try {
      const blob = await this.#engine.exportZip(this.#targetDocId, opts);
      this.dispatch(COPIO_EVENTS.EXPORT_COMPLETE, {
        type: 'zip',
        format: 'zip',
        blob,
        docId: this.docId,
      });
      return blob;
    } catch (err) {
      this.dispatch(COPIO_EVENTS.ERROR, {
        code: err.code || 'EXPORT_FAILED',
        message: err.message,
        error: err,
      });
      throw err;
    }
  }

  async ocr(pageId = null, opts = {}) {
    try {
      const result = await this.#engine.runOcr(this.#targetDocId, pageId, opts);
      this.dispatch(COPIO_EVENTS.OCR_COMPLETE, {
        text: result.text,
        pages: result.pagesResults,
        averageConfidence: result.averageConfidence,
        docId: this.docId,
        pageId,
      });
      return result;
    } catch (err) {
      this.dispatch(COPIO_EVENTS.ERROR, {
        code: err.code || 'OCR_FAILED',
        message: err.message,
        error: err,
      });
      throw err;
    }
  }

  async runOcr(pageId = null, opts = {}) {
    return this.ocr(pageId, opts);
  }

  async sync(opts = {}) {
    try {
      const manager = await this.#engine.sync({
        onStateChange: (state) => {
          if (state && (state.step === 'connected' || state.step === 'syncing')) {
            this.dispatch(COPIO_EVENTS.SYNC_CONNECTED, {
              peerId: state.peerId,
              mode: state.mode,
            });
          }
          if (opts.onStateChange) opts.onStateChange(state);
        },
      });
      return manager;
    } catch (err) {
      this.dispatch(COPIO_EVENTS.ERROR, {
        code: err.code || 'SYNC_FAILED',
        message: err.message,
        error: err,
      });
      throw err;
    }
  }

  get edgeDetection() {
    return this.#edgeDetection;
  }

  /** @param {boolean|string|null|undefined} val */
  set edgeDetection(val) {
    const next = val !== false && val !== 'false' && val !== null && val !== undefined;
    if (this.#edgeDetection !== next) {
      this.#edgeDetection = next;
      this.#syncAttr('edge-detection', String(next));
      if (!this.#edgeDetection) {
        this.#stopLiveEdgeDetection();
        this.#hideLiveQuadOverlay();
      } else if (this.#cameraStream && this.#stage === 'viewfinder') {
        this.#startLiveEdgeDetection();
      }
    }
  }

  get edgeModel() {
    return this.#edgeModel;
  }

  /** @param {'classical'|'ml'|string|null|undefined} val */
  set edgeModel(val) {
    const next = val === 'classical' ? 'classical' : 'ml';
    if (this.#edgeModel !== next) {
      this.#edgeModel = next;
      this.#syncAttr('edge-model', next);
      const edgeService = this.#engine?.getService('edge') || getRegisteredService('edge');
      if (edgeService && 'detector' in edgeService) {
        edgeService.detector = next;
      }
      if (next === 'ml' && edgeService && typeof edgeService.preloadMl === 'function') {
        const stepPillText = this.shadowRoot?.getElementById('step-pill-text');
        const prevText = stepPillText?.textContent;
        if (stepPillText && this.#cameraStream && this.#stage === 'viewfinder') {
          stepPillText.textContent = 'Loading ML Neural model…';
        }
        edgeService.preloadMl().then(() => {
          if (stepPillText && this.#cameraStream && this.#stage === 'viewfinder' && this.#edgeModel === 'ml') {
            stepPillText.textContent = this.mode === 'batch'
              ? `Batch Capture · Page ${this.#pageCount + 1}`
              : 'Camera Active · Tap Shutter to Snap';
          }
        }).catch((err) => {
          console.warn('[CopioScanner] Failed to load ML Neural edge detector:', err);
          if (stepPillText && prevText && this.#stage === 'viewfinder') {
            stepPillText.textContent = prevText;
          }
        });
      }
    }
  }

  get autoCrop() {
    return this.#autoCrop;
  }

  /** @param {boolean|string|null|undefined} val */
  set autoCrop(val) {
    const next = val !== false && val !== 'false' && val !== null && val !== undefined;
    if (this.#autoCrop !== next) {
      this.#autoCrop = next;
      this.#syncAttr('auto-crop', String(next));
    }
  }

  get autoCapture() {
    return this.#autoCapture;
  }

  /** @param {boolean|string|null|undefined} val */
  set autoCapture(val) {
    const next = Boolean(val && val !== 'false');
    if (this.#autoCapture !== next) {
      this.#autoCapture = next;
      this.#syncAttr('auto-capture', String(next));
    }
  }

  /**
   * Returns the current normalized quadrilateral tracked by live edge detection, or null.
   * @returns {import('./core.js').EdgeQuad|null}
   */
  getLiveQuad() {
    return this.#smoothedQuad ? cloneQuad(this.#smoothedQuad) : null;
  }

  /**
   * Returns the latest edge detection result payload, or null.
   * @returns {{ quad: import('./core.js').EdgeQuad, confidence: number, durationMs?: number, isFallback: boolean }|null}
   */
  getLatestDetection() {
    return this.#latestDetectionResult
      ? {
          quad: cloneQuad(this.#latestDetectionResult.quad),
          confidence: this.#latestDetectionResult.confidence,
          durationMs: this.#latestDetectionResult.durationMs,
          isFallback: this.#latestDetectionResult.isFallback,
        }
      : null;
  }

  /**
   * Run edge detection on the current camera video frame.
   * @param {import('../js/adapters/edge/edge-detector-port.js').EdgeDetectOptions} [options]
   * @returns {Promise<import('../js/adapters/edge/edge-detector-port.js').EdgeDetectionResult|null>}
   */
  async detectCurrentFrame(options = {}) {
    const frame = this._grabFrame({
      maxWidth: options.maxProcessingDimension || 480,
      maxHeight: options.maxProcessingDimension || 480,
    });
    if (!frame) return null;
    const edgeService = this.#engine?.getService('edge') || getRegisteredService('edge');
    if (!edgeService || typeof edgeService.detect !== 'function') return null;
    return edgeService.detect(frame, options);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('copio-scanner')) {
  customElements.define('copio-scanner', CopioScanner);
}

export {
  COPIO_EVENTS,
  dispatchCopioEvent,
  scannerCss,
  getScannerStyleSheet,
  adoptScannerStyles,
};
