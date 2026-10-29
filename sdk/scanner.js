/**
 * Copio Scanner Web Components (CPO-034, CPO-035, CPO-036, CPO-037, CPO-061)
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

/**
 * <copio-scanner> Web Component Driving UI Adapter
 * 
 * Embeddable, zero-config document scanner component with configurable features,
 * typed public CustomEvents, and imperative headless methods.
 * 
 * @fires copio:page-added - When a page is added
 * @fires copio:page-removed - When a page is deleted
 * @fires copio:pages-changed - When pages are modified, reordered, or cleared
 * @fires copio:scan-complete - When a multi-page scan session finishes
 * @fires copio:export-progress - During document export generation
 * @fires copio:export-complete - When an export binary Blob is generated
 * @fires copio:ocr-complete - When text recognition finishes
 * @fires copio:sync-connected - When P2P sync peer links
 * @fires copio:error - When an error occurs or a disabled feature is invoked
 */
export class CopioScanner extends BaseElement {
  #engine = null;
  #storage = null;
  #unsubscribeRepo = null;
  #isOpen = false;

  static get observedAttributes() {
    return [
      'mode',
      'doc-id',
      'features',
      'export-formats',
      'ocr-languages',
      'max-pages',
      'asset-base',
      'license-key',
      'theme',
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
    }
    this.#engine = new CopioEngine(opts);
  }

  connectedCallback() {
    if (this.shadowRoot) {
      adoptScannerStyles(this.shadowRoot);
      if (!this.shadowRoot.innerHTML) {
        this.shadowRoot.innerHTML = `
          <div class="copio-scanner-container" part="scanner-root">
            <header class="copio-header" part="header">
              <div class="copio-header-left">
                <span class="copio-mode-badge">${(this.mode || 'document').toUpperCase()}</span>
                <div class="copio-title-group">
                  <h2 class="copio-title">Copio Scanner</h2>
                  <p class="copio-subtitle">Non-destructive mobile document scanner</p>
                </div>
              </div>
              <div class="copio-header-actions">
                <slot name="header-actions"></slot>
              </div>
            </header>

            <div class="copio-viewfinder" part="viewfinder">
              <slot name="viewfinder"></slot>
              <div class="copio-shutter-dock" part="shutter-dock">
                <slot name="shutter-dock">
                  <button type="button" class="copio-shutter-btn" aria-label="Capture page">
                    <span class="copio-shutter-btn-inner"></span>
                  </button>
                </slot>
              </div>
            </div>

            <div class="copio-workbench" part="workbench" style="display: none;">
              <div class="copio-stage-canvas">
                <slot name="stage"></slot>
              </div>
              <div class="copio-filmstrip">
                <slot name="filmstrip"></slot>
              </div>
              <footer class="copio-toolbar" part="toolbar">
                <slot name="toolbar">
                  <button type="button" class="copio-btn copio-btn-primary">Done</button>
                </slot>
              </footer>
            </div>

            <slot></slot>
          </div>
        `;
      }
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
      });
    }

    if (this.hasAttribute && this.hasAttribute('asset-base')) {
      setAssetBase(this.getAttribute('asset-base'));
    }
  }

  disconnectedCallback() {
    if (typeof this.#unsubscribeRepo === 'function') {
      this.#unsubscribeRepo();
      this.#unsubscribeRepo = null;
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
        break;
      case 'export-formats':
        this.#engine.exportFormats = newValue;
        break;
      case 'ocr-languages':
        this.#engine.ocrLanguages = newValue;
        break;
      case 'max-pages':
        this.#engine.maxPages = newValue;
        break;
      case 'asset-base':
        this.#engine.assetBase = newValue;
        break;
      case 'license-key':
        this.#engine.licenseKey = newValue;
        break;
    }
  }

  // --- Configuration Properties (CPO-035, CPO-038) ---

  /**
   * Theme variant ('dark' | 'light' | 'brand' | 'auto').
   * @type {'dark'|'light'|'brand'|'auto'}
   */
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

  /**
   * Scanner operational mode: 'single' | 'document'
   * @type {'single'|'document'}
   */
  get mode() {
    return typeof this.getAttribute === 'function'
      ? /** @type {'single'|'document'} */ (this.getAttribute('mode') || 'document')
      : 'document';
  }

  set mode(val) {
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('mode', val);
    }
  }

  /**
   * Current active document ID.
   * @type {string|null}
   */
  get docId() {
    return typeof this.getAttribute === 'function' ? this.getAttribute('doc-id') : null;
  }

  set docId(val) {
    if (typeof this.setAttribute === 'function') {
      if (val) this.setAttribute('doc-id', val);
      else this.removeAttribute('doc-id');
    }
  }

  /**
   * Enabled feature flags ('crop rotate filter ocr export sync')
   * @type {string[]}
   */
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

  /**
   * Check if a specific feature is enabled on this scanner instance.
   * @param {string} featureName
   * @returns {boolean}
   */
  hasFeature(featureName) {
    return this.#engine ? this.#engine.hasFeature(featureName) : false;
  }

  /**
   * Enabled export formats ('pdf', 'zip', 'png', 'jpg').
   * @type {string[]}
   */
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

  /**
   * Configured OCR language codes ('eng', 'deu', etc.).
   * @type {string[]}
   */
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

  /**
   * Maximum page limit (0 = unlimited).
   * @type {number}
   */
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

  /**
   * Asset base path for lazy worker and WASM chunks.
   * @type {string}
   */
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

  /**
   * Commercial SDK license key.
   * @type {string}
   */
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

  /**
   * Pluggable persistence adapter (implements StoragePort).
   * @type {Object}
   */
  get storage() {
    return this.#storage;
  }

  set storage(adapter) {
    this.#storage = adapter;
    if (this.#engine) {
      this.#engine.setStorage(adapter);
    }
  }

  /**
   * Underlying headless CopioEngine instance.
   * @type {CopioEngine}
   */
  get engine() {
    return this.#engine;
  }

  set engine(customEngine) {
    if (customEngine instanceof CopioEngine) {
      this.#engine = customEngine;
    }
  }

  // --- Public Event Dispatcher Helper (CPO-036) ---

  /**
   * Dispatch a namespaced Copio event configured with bubbles: true, composed: true.
   * @param {string} eventName
   * @param {Object} [detail={}]
   * @returns {CustomEvent}
   */
  dispatch(eventName, detail = {}) {
    return dispatchCopioEvent(this, eventName, detail);
  }

  // --- Public Methods API (CPO-037) ---

  /**
   * Opens or activates the scanner interface.
   * @returns {Promise<void>}
   */
  async open() {
    this.#isOpen = true;
    if (typeof this.focus === 'function') this.focus();
  }

  /**
   * Closes or hides the scanner interface.
   * @returns {Promise<void>}
   */
  async close() {
    this.#isOpen = false;
  }

  /**
   * Whether the scanner is currently open.
   * @type {boolean}
   */
  get isOpen() {
    return this.#isOpen;
  }

  /**
   * Capture a new image from the camera or direct input.
   * In headless/custom environments, opens camera or file picker.
   * 
   * @returns {Promise<Object|null>} The captured page entity
   */
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

  /**
   * Process and append files (images or PDFs) to the document.
   * Emits copio:page-added for each page and copio:pages-changed.
   * 
   * @param {FileList|File[]|Blob[]} files
   * @returns {Promise<Array<Object>>}
   */
  async addFiles(files) {
    try {
      const newPages = await this.#engine.addFiles(files, this.docId);
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

      if (this.mode === 'single' && newPages.length > 0) {
        this.dispatch(COPIO_EVENTS.SCAN_COMPLETE, {
          docId: this.docId,
          pages: allPages,
          pageCount: allPages.length,
        });
      }

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

  /**
   * Get list of pages for the current document.
   * @returns {Promise<Array<Object>>}
   */
  async getPages() {
    return this.#engine.getPages(this.docId);
  }

  /**
   * Clear all pages from the current document.
   * Emits copio:pages-changed.
   * @returns {Promise<void>}
   */
  async clear() {
    await this.#engine.clear(this.docId);
    this.dispatch(COPIO_EVENTS.PAGES_CHANGED, {
      pages: [],
      docId: this.docId,
    });
  }

  /**
   * Export document pages as a PDF Blob.
   * Does NOT trigger browser download unless opts.download === true.
   * Emits copio:export-complete.
   * 
   * @param {Object} [opts]
   * @param {boolean} [opts.download=false]
   * @param {Function} [opts.onProgress]
   * @returns {Promise<Blob>}
   */
  async exportPdf(opts = {}) {
    try {
      const blob = await this.#engine.exportPdf(this.docId, opts);
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

  /**
   * Export document pages as a ZIP archive Blob.
   * Does NOT trigger browser download unless opts.download === true.
   * Emits copio:export-complete.
   * 
   * @param {Object} [opts]
   * @param {boolean} [opts.download=false]
   * @param {Function} [opts.onProgress]
   * @returns {Promise<Blob>}
   */
  async exportZip(opts = {}) {
    try {
      const blob = await this.#engine.exportZip(this.docId, opts);
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

  /**
   * Run optical character recognition on document pages.
   * Emits copio:ocr-complete.
   * 
   * @param {string} [pageId] - Specific page ID to recognize
   * @param {Object} [opts]
   * @returns {Promise<Object>}
   */
  async ocr(pageId = null, opts = {}) {
    try {
      const result = await this.#engine.runOcr(this.docId, pageId, opts);
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

  /**
   * Launch P2P synchronization.
   * Emits copio:sync-connected when connected.
   * 
   * @param {Object} [opts]
   * @returns {Promise<Object>}
   */
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
