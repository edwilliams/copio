/**
 * Copio Scanner Web Component (CPO-034, CPO-035, CPO-036, CPO-037, CPO-038, CPO-045)
 * 
 * Embeddable, zero-config two-stage (viewfinder ↔ workbench) document scanner
 * acting as the primary Driving UI Adapter over the headless CopioEngine.
 */
import { CopioEngine } from './core.js';
import { COPIO_EVENTS, dispatchCopioEvent } from './events.js';
import { CopioImages } from '../js/routes/doc/copio-images.js';
import { CopioCarousel } from '../js/routes/doc/copio-carousel.js';
import { CopioAddEditDialog } from '../js/routes/add-edit/copio-add-edit-dialog.js';
import { CopioRow } from '../js/routes/home/copio-row.js';
import { CopioHeader } from '../js/components/copio-header.js';
import { CopioLoader } from '../js/components/copio-loader.js';
import { setAssetBase } from '../js/utils/module-loader.js';
import { setContainer, getContainer } from '../js/services/notify.js';
import { scannerCss, getScannerStyleSheet, adoptScannerStyles } from './styles.js';

/** @type {typeof HTMLElement} */
const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : /** @type {any} */ (class {});

export class CopioScanner extends BaseElement {
  #engine = null;
  #storage = null;
  #unsubscribeRepo = null;
  #isOpen = false;
  #stage = 'viewfinder'; // 'viewfinder' | 'workbench'
  #activePageIndex = 0;
  #cropMode = false;
  #draftCrop = null;
  #undoTimer = null;
  #undoRemaining = 0;
  #renderPromise = null;
  #sessionDocId = null;

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
    }
    this.#engine = new CopioEngine(opts);
  }

  connectedCallback() {
    if (this.shadowRoot) {
      adoptScannerStyles(this.shadowRoot);
      this.#buildInitialDom();
    }

    if (typeof setContainer === 'function' && typeof document !== 'undefined' && getContainer() === document.body) {
      setContainer(this.shadowRoot?.querySelector('.copio-scanner-container') || this);
    }

    // Subscribe to engine repository changes
    if (this.#engine) {
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

    this.#updateChildViews();
    this.#syncView();
  }

  disconnectedCallback() {
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
      case 'stage':
        if (newValue === 'viewfinder' || newValue === 'workbench') {
          this.#stage = newValue;
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
            <div class="copio-privacy-pill" title="100% Local On-Device Processing">
              <span>🔒 100% Local</span>
            </div>
          </div>

          <div class="copio-camera-feed" id="camera-feed">
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
        this.stage = 'workbench';
      }
    });

    // Shutter capture button
    shadow.getElementById('btn-shutter')?.addEventListener('click', async () => {
      await this.#handleShutterClick();
    });

    // Review pill
    shadow.getElementById('btn-review')?.addEventListener('click', () => {
      this.stage = 'workbench';
    });

    // Workbench tools
    shadow.getElementById('btn-retake')?.addEventListener('click', () => {
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

    // Card switcher buttons
    shadow.getElementById('btn-card-front')?.addEventListener('click', () => {
      this.#activePageIndex = 0;
      this.#syncView();
    });

    shadow.getElementById('btn-card-back')?.addEventListener('click', () => {
      this.#activePageIndex = 1;
      this.#syncView();
    });

    // Crop handle dragging
    this.#bindCropHandles();
  }

  #bindCropHandles() {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    const cropBox = shadow.getElementById('crop-box');
    const handles = shadow.querySelectorAll('.copio-crop-handle');
    if (!cropBox || handles.length === 0) return;

    let activeHandle = null;
    let startX = 0;
    let startY = 0;
    let initialCrop = null;

    const onPointerDown = (e) => {
      const handleEl = e.target.closest('.copio-crop-handle');
      if (!handleEl) return;
      e.preventDefault();
      e.stopPropagation();

      activeHandle = handleEl.getAttribute('data-handle');
      startX = e.clientX;
      startY = e.clientY;
      initialCrop = this.#draftCrop ? { ...this.#draftCrop } : { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!activeHandle || !initialCrop) return;
      const viewport = shadow.getElementById('canvas-viewport');
      const rect = viewport?.getBoundingClientRect() || { width: 300, height: 400 };

      const dx = (e.clientX - startX) / Math.max(rect.width, 1);
      const dy = (e.clientY - startY) / Math.max(rect.height, 1);

      let { x, y, w, h } = initialCrop;

      if (activeHandle.includes('w')) {
        const nextX = Math.min(Math.max(0, x + dx), x + w - 0.1);
        w += x - nextX;
        x = nextX;
      }
      if (activeHandle.includes('e')) {
        w = Math.min(Math.max(0.1, w + dx), 1 - x);
      }
      if (activeHandle.includes('n')) {
        const nextY = Math.min(Math.max(0, y + dy), y + h - 0.1);
        h += y - nextY;
        y = nextY;
      }
      if (activeHandle.includes('s')) {
        h = Math.min(Math.max(0.1, h + dy), 1 - y);
      }

      this.#draftCrop = { x, y, w, h };
      this.#updateCropBoxUi();
    };

    const onPointerUp = () => {
      activeHandle = null;
      initialCrop = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', onPointerDown);
    });
  }

  #updateCropBoxUi() {
    const shadow = this.shadowRoot;
    if (!shadow || !this.#draftCrop) return;
    const cropBox = shadow.getElementById('crop-box');
    if (!cropBox) return;

    cropBox.style.left = `${(this.#draftCrop.x * 100).toFixed(1)}%`;
    cropBox.style.top = `${(this.#draftCrop.y * 100).toFixed(1)}%`;
    cropBox.style.width = `${(this.#draftCrop.w * 100).toFixed(1)}%`;
    cropBox.style.height = `${(this.#draftCrop.h * 100).toFixed(1)}%`;
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
        if (this.aspect === 'card' && this.maxPages === 2) {
          stepPillText.textContent = pages.length === 0
            ? 'Step 1 of 2: Capture Front of ID Card'
            : 'Step 2 of 2: Capture Back of ID Card';
        } else if (this.mode === 'batch') {
          stepPillText.textContent = `Batch Capture · Page ${pages.length + 1}`;
        } else {
          stepPillText.textContent = 'Align Document Inside Frame';
        }
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
        const isCardGuided = this.aspect === 'card' && (this.maxPages === 2 || pages.length <= 2);
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

      // Image in viewport: in crop mode show originalSrc, otherwise show src
      let cropLayer = shadow.getElementById('crop-layer');
      if (this.#cropMode) {
        if (!cropLayer) {
          const wrapper = shadow.getElementById('canvas-wrapper');
          cropLayer = document.createElement('div');
          cropLayer.className = 'copio-crop-layer';
          cropLayer.id = 'crop-layer';
          cropLayer.innerHTML = `
            <div class="copio-crop-box" id="crop-box">
              <span class="copio-crop-handle nw" data-handle="nw"></span>
              <span class="copio-crop-handle ne" data-handle="ne"></span>
              <span class="copio-crop-handle se" data-handle="se"></span>
              <span class="copio-crop-handle sw" data-handle="sw"></span>
              <span class="copio-crop-handle edge-n" data-handle="n"></span>
              <span class="copio-crop-handle edge-e" data-handle="e"></span>
              <span class="copio-crop-handle edge-s" data-handle="s"></span>
              <span class="copio-crop-handle edge-w" data-handle="w"></span>
            </div>
          `;
          wrapper?.appendChild(cropLayer);
          this.#bindCropHandles();
        }
        cropLayer.style.display = 'block';
        this.#draftCrop = activePage.edits?.crop || { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
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
        if (this.aspect === 'card' && this.maxPages === 2 && pages.length === 1) {
          primaryCta.textContent = 'Next: Capture Back (Step 2/2) →';
        } else if (this.aspect === 'card' && pages.length >= 2) {
          primaryCta.textContent = '✓ Complete ID Scan (2 Sides)';
        } else if (this.mode === 'batch') {
          primaryCta.textContent = `✓ Complete Scan (${pages.length} Pages)`;
        } else {
          primaryCta.textContent = '✓ Use Photo';
        }
      }

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

  async #handleShutterClick() {
    // If capture method is invoked via shutter click
    const shadow = this.shadowRoot;
    const fileInput = shadow?.getElementById('internal-file-input');

    if (fileInput && typeof fileInput.click === 'function') {
      fileInput.click();
    }
  }

  async #rotateActivePage() {
    const pages = await this.getPages();
    const activePage = pages[this.#activePageIndex];
    if (!activePage) return;

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
      const draft = this.#draftCrop;
      this.#draftCrop = null;
      if (draft) {
        await this.#engine.applyEdit(this.#targetDocId, activePage.id, {
          crop: draft,
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

      body.innerHTML = `
        <div class="copio-ocr-content">
          <pre class="copio-ocr-text">${result.text || 'No text detected.'}</pre>
          <div class="copio-ocr-meta">
            <span>Confidence: ${Math.round((result.averageConfidence || 0) * 100)}%</span>
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

    this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, payload);
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

  get features() {
    return this.#engine ? this.#engine.features : [];
  }

  set features(val) {
    if (typeof this.setAttribute === 'function') {
      const str = Array.isArray(val) ? val.join(' ') : String(val || '');
      this.setAttribute('features', str);
    }
    if (this.#engine) {
      this.#engine.setFeatures(val);
    }
  }

  hasFeature(featureName) {
    return this.#engine ? this.#engine.hasFeature(featureName) : false;
  }

  get ocrEnabled() {
    return this.#engine ? this.#engine.ocr : true;
  }

  set ocrEnabled(val) {
    const enabled = Boolean(val);
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('ocr', enabled ? 'true' : 'false');
    }
    if (this.#engine) {
      this.#engine.ocr = enabled;
    }
    this.#updateChildViews();
  }

  get pdf() {
    return this.#engine ? this.#engine.pdf : true;
  }

  set pdf(val) {
    const enabled = Boolean(val);
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('pdf', enabled ? 'true' : 'false');
    }
    if (this.#engine) {
      this.#engine.pdf = enabled;
    }
    this.#updateChildViews();
  }

  get exportFormats() {
    return this.#engine ? this.#engine.exportFormats : [];
  }

  set exportFormats(val) {
    if (typeof this.setAttribute === 'function') {
      const str = Array.isArray(val) ? val.join(',') : String(val || '');
      this.setAttribute('export-formats', str);
    }
    if (this.#engine) {
      this.#engine.exportFormats = val;
    }
  }

  get ocrLanguages() {
    return this.#engine ? this.#engine.ocrLanguages : [];
  }

  set ocrLanguages(val) {
    if (typeof this.setAttribute === 'function') {
      const str = Array.isArray(val) ? val.join(',') : String(val || '');
      this.setAttribute('ocr-languages', str);
    }
    if (this.#engine) {
      this.#engine.ocrLanguages = val;
    }
  }

  get maxPages() {
    return this.#engine ? this.#engine.maxPages : 0;
  }

  set maxPages(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('max-pages', String(val));
    }
    if (this.#engine) {
      this.#engine.maxPages = val;
    }
  }

  get assetBase() {
    return this.#engine ? this.#engine.assetBase : '';
  }

  set assetBase(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('asset-base', String(val || ''));
    }
    if (this.#engine) {
      this.#engine.assetBase = val;
    }
  }

  get licenseKey() {
    return this.#engine ? this.#engine.licenseKey : '';
  }

  set licenseKey(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('license-key', String(val || ''));
    }
    if (this.#engine) {
      this.#engine.licenseKey = val;
    }
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

  async addFiles(files) {
    try {
      const newPages = await this.#engine.addFiles(files, this.#targetDocId);
      for (let i = 0; i < newPages.length; i++) {
        this.dispatch(COPIO_EVENTS.PAGE_ADDED, {
          page: newPages[i],
          pageNumber: i + 1,
          docId: this.docId,
          source: 'file',
        });
      }

      const allPages = await this.getPages();
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
          page: allPages[0] || null,
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
}

if (typeof customElements !== 'undefined' && !customElements.get('copio-scanner')) {
  customElements.define('copio-scanner', CopioScanner);
}

export {
  CopioImages,
  CopioCarousel,
  CopioAddEditDialog,
  CopioRow,
  CopioHeader,
  CopioLoader,
  COPIO_EVENTS,
  dispatchCopioEvent,
  scannerCss,
  getScannerStyleSheet,
  adoptScannerStyles,
};
