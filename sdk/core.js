/**
 * Copio Headless Core Domain & Storage (CPO-035, CPO-037, CPO-045, CPO-061)
 * 
 * Hexagonal Core: Pure JS domain use cases, models, and driven ports.
 * Zero DOM, zero Lit, zero browser UI globals.
 * 
 * Outbound driven ports (StoragePort, PdfPort, OcrPort, SyncPort) are decoupled
 * via pluggable service adapters, keeping core strictly under 80KB.
 */
import { DocRepository, docRepository } from '../js/services/doc-repository.js';
import {
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  createDefaultAdapter,
} from '../js/adapters/storage/index.js';
import {
  randomId,
  fileToBase64,
  thresholdSrc,
  rotateSrc,
  getCroppedSrc,
  extractExif,
  applyEdits,
  normalizeEdits,
  renderEditsToCanvas,
  applySauvolaToImageData,
} from '../js/utils/utils.js';
import { setAssetBase, getAssetBase } from '../js/utils/module-loader.js';
import { BUILD_DATE, VERSION } from './version.js';
import { NullOcrAdapter } from '../js/adapters/ocr/null-ocr-adapter.js';
import { NullPdfAdapter } from '../js/adapters/pdf/null-pdf-adapter.js';
import {
  ImageProcessorPort,
  Canvas2DAdapter,
  NullImageProcessorAdapter,
} from '../js/adapters/image/index.js';
import {
  Document,
  Page,
  ScanSession,
  normalizeEditStack,
  hasActiveEdits,
} from './models.js';

export const DEFAULT_FEATURES = ['crop', 'rotate', 'filter', 'ocr', 'export', 'sync'];
export const DEFAULT_EXPORT_FORMATS = ['pdf', 'zip', 'png', 'jpg'];
export const DEFAULT_OCR_LANGUAGES = ['eng'];

const registeredServices = {};

/**
 * Register a pluggable service adapter for headless ports (export, ocr, sync, pdf).
 * @param {string} name 
 * @param {any} service 
 */
export function registerService(name, service) {
  if (!name || !service) return;
  registeredServices[name] = service;
  if (typeof globalThis !== 'undefined') {
    globalThis.__copio_services__ = globalThis.__copio_services__ || {};
    globalThis.__copio_services__[name] = service;
  }
}

/**
 * Retrieve a registered service adapter.
 * @param {string} name 
 * @returns {any}
 */
export function getRegisteredService(name) {
  if (registeredServices[name]) return registeredServices[name];
  if (typeof globalThis !== 'undefined' && globalThis.__copio_services__?.[name]) {
    return globalThis.__copio_services__[name];
  }
  return null;
}

/**
 * Normalizes features input (space/comma separated string or array) into a Set.
 * @param {string|string[]|Set<string>} features 
 * @returns {Set<string>}
 */
function normalizeFeatures(features) {
  if (!features) return new Set(DEFAULT_FEATURES);
  if (features instanceof Set) return new Set(features);
  if (Array.isArray(features)) {
    return new Set(features.map((f) => String(f).trim().toLowerCase()).filter(Boolean));
  }
  if (typeof features === 'string') {
    return new Set(
      features
        .split(/[\s,]+/)
        .map((f) => f.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return new Set(DEFAULT_FEATURES);
}

/**
 * Normalizes array or comma-separated string list.
 * @param {string|string[]} val 
 * @param {string[]} defaultVal 
 * @returns {string[]}
 */
function normalizeList(val, defaultVal) {
  if (!val) return [...defaultVal];
  if (Array.isArray(val)) return val.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  if (typeof val === 'string') {
    return val
      .split(/[\s,]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [...defaultVal];
}

/**
 * Headless Copio Engine driving port.
 */
export class CopioEngine {
  #features = new Set(DEFAULT_FEATURES);
  #exportFormats = [...DEFAULT_EXPORT_FORMATS];
  #ocrLanguages = [...DEFAULT_OCR_LANGUAGES];
  #maxPages = 0;
  #licenseKey = '';
  #storage = null;
  #repository = null;
  #services = {};
  #ocr = true;
  #pdf = true;
  #imageProcessor = null;
  #undoStack = new Map();
  #redoStack = new Map();

  /**
   * @param {Object} [options]
   * @param {StoragePort} [options.storage] - Persistence adapter implementing StoragePort
   * @param {DocRepository} [options.repository] - Headless document repository instance
   * @param {Object} [options.services] - Custom driven adapters ({ export, ocr, sync, pdf, imageProcessor })
   * @param {ImageProcessorPort} [options.imageProcessor] - Image transform adapter
   * @param {string|string[]} [options.features] - Enabled feature set ('crop rotate filter ocr export sync')
   * @param {string|string[]} [options.exportFormats] - Supported export formats ('pdf', 'zip', 'png', 'jpg')
   * @param {string|string[]} [options.ocrLanguages] - Configured OCR languages ('eng', 'deu', etc.)
   * @param {number} [options.maxPages=0] - Maximum allowed pages (0 = unlimited)
   * @param {string} [options.assetBase] - Base URL for lazy-loaded assets and workers
   * @param {string} [options.licenseKey] - SDK commercial license key
   * @param {boolean} [options.ocr=true] - Whether OCR module is enabled (developer opt-in CPO-042)
   * @param {boolean} [options.pdf=true] - Whether PDF module is enabled (developer opt-in CPO-042)
   */
  constructor(options = {}) {
    this.#storage = options.storage || createDefaultAdapter(/** @type {any} */ (options));
    this.#repository = options.repository || new DocRepository(this.#storage);

    if (options.services) {
      this.#services = { ...options.services };
    }
    if (options.imageProcessor) {
      this.#imageProcessor = options.imageProcessor;
      this.#services.imageProcessor = options.imageProcessor;
    } else if (this.getService('imageProcessor')) {
      this.#imageProcessor = this.getService('imageProcessor');
    } else if (typeof document !== 'undefined') {
      this.#imageProcessor = new Canvas2DAdapter();
    } else {
      this.#imageProcessor = new NullImageProcessorAdapter();
    }
    if (options.features !== undefined) {
      this.setFeatures(options.features);
    }
    if (options.exportFormats !== undefined) {
      this.#exportFormats = normalizeList(options.exportFormats, DEFAULT_EXPORT_FORMATS);
    }
    if (options.ocrLanguages !== undefined) {
      this.#ocrLanguages = normalizeList(options.ocrLanguages, DEFAULT_OCR_LANGUAGES);
    }
    if (options.maxPages !== undefined) {
      this.#maxPages = Math.max(0, Number(options.maxPages) || 0);
    }
    if (options.assetBase !== undefined) {
      setAssetBase(options.assetBase);
    }
    if (options.licenseKey !== undefined) {
      this.#licenseKey = String(options.licenseKey || '');
    }
    if (options.ocr !== undefined) {
      this.ocr = Boolean(options.ocr);
    } else if (options.features !== undefined && !this.hasFeature('ocr')) {
      this.ocr = false;
    }
    if (options.pdf !== undefined) {
      this.pdf = Boolean(options.pdf);
    } else if (options.exportFormats !== undefined && !this.#exportFormats.includes('pdf')) {
      this.pdf = false;
    }
  }

  /**
   * Initializes the underlying storage adapter.
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    return this.#storage.init();
  }

  // --- Configuration & Feature Gating API (CPO-035) ---

  /**
   * Register or override an adapter service for this engine instance.
   * @param {string} name 
   * @param {any} service 
   */
  setService(name, service) {
    this.#services[name] = service;
  }

  /**
   * Retrieve an adapter service instance.
   * @param {string} name 
   * @returns {any}
   */
  getService(name) {
    return this.#services[name] || getRegisteredService(name);
  }

  /**
   * Check if a specific feature is enabled.
   * @param {string} featureName
   * @returns {boolean}
   */
  hasFeature(featureName) {
    if (!featureName) return false;
    return this.#features.has(String(featureName).trim().toLowerCase());
  }

  /**
   * Returns list of currently enabled features.
   * @returns {string[]}
   */
  get features() {
    return Array.from(this.#features);
  }

  /**
   * Set enabled features.
   * @param {string|string[]|Set<string>} features
   */
  setFeatures(features) {
    this.#features = normalizeFeatures(features);
    if (!this.hasFeature('ocr')) {
      this.#ocr = false;
      this.setService('ocr', new NullOcrAdapter());
    } else {
      this.#ocr = true;
      if (this.getService('ocr') instanceof NullOcrAdapter) {
        this.setService('ocr', getRegisteredService('ocr'));
      }
    }
  }

  /**
   * Enable a specific feature.
   * @param {string} featureName
   */
  enableFeature(featureName) {
    if (featureName) {
      const name = String(featureName).trim().toLowerCase();
      this.#features.add(name);
      if (name === 'ocr') {
        this.#ocr = true;
        if (this.getService('ocr') instanceof NullOcrAdapter) {
          this.setService('ocr', getRegisteredService('ocr'));
        }
      }
    }
  }

  /**
   * Disable a specific feature.
   * @param {string} featureName
   */
  disableFeature(featureName) {
    if (featureName) {
      const name = String(featureName).trim().toLowerCase();
      this.#features.delete(name);
      if (name === 'ocr') {
        this.#ocr = false;
        this.setService('ocr', new NullOcrAdapter());
      }
    }
  }

  /**
   * Developer opt-in status for OCR heavy module (CPO-042).
   * @type {boolean}
   */
  get ocr() {
    return this.#ocr && this.hasFeature('ocr');
  }

  set ocr(enabled) {
    this.#ocr = Boolean(enabled);
    if (this.#ocr) {
      this.enableFeature('ocr');
      if (this.getService('ocr') instanceof NullOcrAdapter) {
        this.setService('ocr', getRegisteredService('ocr'));
      }
    } else {
      this.disableFeature('ocr');
      this.setService('ocr', new NullOcrAdapter());
    }
  }

  /**
   * Developer opt-in status for PDF heavy module (CPO-042).
   * @type {boolean}
   */
  get pdf() {
    return this.#pdf && this.#exportFormats.includes('pdf');
  }

  set pdf(enabled) {
    this.#pdf = Boolean(enabled);
    if (this.#pdf) {
      if (!this.#exportFormats.includes('pdf')) {
        this.#exportFormats.push('pdf');
      }
      if (this.getService('pdf') instanceof NullPdfAdapter) {
        this.setService('pdf', getRegisteredService('pdf'));
      }
    } else {
      this.#exportFormats = this.#exportFormats.filter((f) => f !== 'pdf');
      this.setService('pdf', new NullPdfAdapter());
    }
  }

  /**
   * Get supported export formats.
   * @returns {string[]}
   */
  get exportFormats() {
    return [...this.#exportFormats];
  }

  /**
   * Set supported export formats.
   * @param {string|string[]} formats
   */
  set exportFormats(formats) {
    this.#exportFormats = normalizeList(formats, DEFAULT_EXPORT_FORMATS);
    if (!this.#exportFormats.includes('pdf')) {
      this.#pdf = false;
      this.setService('pdf', new NullPdfAdapter());
    } else {
      this.#pdf = true;
      if (this.getService('pdf') instanceof NullPdfAdapter) {
        this.setService('pdf', getRegisteredService('pdf'));
      }
    }
  }

  /**
   * Get configured OCR languages.
   * @returns {string[]}
   */
  get ocrLanguages() {
    return [...this.#ocrLanguages];
  }

  /**
   * Set configured OCR languages.
   * @param {string|string[]} langs
   */
  set ocrLanguages(langs) {
    this.#ocrLanguages = normalizeList(langs, DEFAULT_OCR_LANGUAGES);
  }

  /**
   * Maximum page limit (0 = unlimited).
   * @returns {number}
   */
  get maxPages() {
    return this.#maxPages;
  }

  /**
   * Set maximum page limit.
   * @param {number} limit
   */
  set maxPages(limit) {
    this.#maxPages = Math.max(0, Number(limit) || 0);
  }

  /**
   * Get asset base path.
   * @returns {string}
   */
  get assetBase() {
    return getAssetBase();
  }

  /**
   * Set asset base path for lazy worker/WASM loading.
   * @param {string} base
   */
  set assetBase(base) {
    setAssetBase(base);
  }

  /**
   * License key.
   * @returns {string}
   */
  get licenseKey() {
    return this.#licenseKey;
  }

  /**
   * Set license key.
   * @param {string} key
   */
  set licenseKey(key) {
    this.#licenseKey = String(key || '');
  }

  /**
   * Underlying StoragePort adapter.
   * @returns {StoragePort}
   */
  get storage() {
    return this.#storage;
  }

  /**
   * Switch the underlying storage adapter.
   * @param {StoragePort} newStorage
   */
  setStorage(newStorage) {
    if (!newStorage) return;
    this.#storage = newStorage;
    this.#repository = new DocRepository(this.#storage);
  }

  #pushUndo(docId, action) {
    if (!this.#undoStack.has(docId)) {
      this.#undoStack.set(docId, []);
    }
    const stack = this.#undoStack.get(docId);
    stack.push(action);
    if (stack.length > 50) stack.shift();
    if (this.#redoStack.has(docId)) {
      this.#redoStack.get(docId).length = 0;
    }
  }

  /**
   * Current ImageProcessorPort adapter.
   * @type {ImageProcessorPort}
   */
  get imageProcessor() {
    return this.#imageProcessor;
  }

  setImageProcessor(processor) {
    if (!processor) return;
    this.#imageProcessor = processor;
    this.setService('imageProcessor', processor);
  }

  /**
   * Underlying document repository.
   * @returns {DocRepository}
   */
  get docs() {
    return this.#repository;
  }

  // --- Document Repository Delegation ---

  async listDocuments() {
    return this.#repository.listDocs();
  }

  async getDocument(id) {
    return this.#repository.getDoc(id);
  }

  async createDocument(name, pages) {
    return this.#repository.createDoc(name, pages);
  }

  async deleteDocument(id, options = {}) {
    return this.#repository.deleteDoc(id, options);
  }

  async undoDeleteDocument(id) {
    return this.#repository.undoDeleteDoc(id);
  }

  async renameDocument(id, name) {
    return this.#repository.renameDoc(id, name);
  }

  async addPages(id, pages) {
    return this.#repository.addPages(id, pages);
  }

  async deletePage(id, pageId, options = {}) {
    this.#pushUndo(id, { type: 'delete', pageId });
    return this.#repository.deletePage(id, pageId, options);
  }

  async undoDeletePage(id, pageId) {
    return this.#repository.undoDeletePage(id, pageId);
  }

  async updatePage(id, pageId, updates) {
    return this.#repository.updatePage(id, pageId, updates);
  }

  async reorderPages(id, pageIds) {
    const doc = await this.getDocument(id);
    const priorOrder = doc?.pages ? doc.pages.map((p) => p.id) : [];
    this.#pushUndo(id, { type: 'reorder', priorOrder, newOrder: [...pageIds] });
    return this.#repository.reorderPages(id, pageIds);
  }

  async #resolveDocId(docId) {
    if (docId) return docId;
    const docs = await this.listDocuments();
    return docs.length > 0 ? docs[0].id : null;
  }

  /**
   * Applies non-destructive edits to a document page (CPO-011, CPO-045).
   * Generates derived src via ImageProcessorPort while keeping originalSrc intact.
   * 
   * @param {string} docId
   * @param {string} pageId
   * @param {Object} edits
   * @returns {Promise<Object>}
   */
  async applyEdit(docId, pageId, edits) {
    const targetDocId = await this.#resolveDocId(docId);
    const doc = targetDocId ? await this.getDocument(targetDocId) : null;
    if (!doc || !doc.pages) {
      throw new Error(`Document with ID "${targetDocId || docId}" not found`);
    }
    const page = doc.pages.find((p) => p.id === pageId);
    if (!page) {
      throw new Error(`Page with ID "${pageId}" not found in document "${targetDocId}"`);
    }

    const priorEdits = { ...(page.edits || { crop: null, rotate: 0, filter: 'none' }) };
    const priorSrc = page.src;
    const mergedEdits = normalizeEditStack({ ...priorEdits, ...edits });
    const originalSrc = page.originalSrc || page.src;

    let derivedSrc = originalSrc;
    if (this.#imageProcessor) {
      derivedSrc = await this.#imageProcessor.renderEdits(originalSrc, mergedEdits);
    }

    await this.updatePage(targetDocId, pageId, {
      originalSrc,
      src: derivedSrc,
      edits: mergedEdits,
    });

    this.#pushUndo(targetDocId, {
      type: 'edit',
      pageId,
      priorEdits,
      priorSrc,
      newEdits: mergedEdits,
      newSrc: derivedSrc,
    });

    return {
      ...page,
      originalSrc,
      src: derivedSrc,
      edits: mergedEdits,
    };
  }

  /**
   * Reverts the most recent operation on a document (CPO-016, CPO-045).
   * @param {string} docId
   * @returns {Promise<Object|null>}
   */
  async undo(docId) {
    const targetDocId = await this.#resolveDocId(docId);
    const stack = targetDocId ? this.#undoStack.get(targetDocId) : null;
    if (!stack || stack.length === 0) return null;
    const action = stack.pop();

    if (!this.#redoStack.has(targetDocId)) {
      this.#redoStack.set(targetDocId, []);
    }
    this.#redoStack.get(targetDocId).push(action);

    if (action.type === 'edit') {
      await this.updatePage(targetDocId, action.pageId, {
        edits: action.priorEdits,
        src: action.priorSrc,
      });
      return { type: 'edit', pageId: action.pageId, restoredEdits: action.priorEdits };
    } else if (action.type === 'delete') {
      await this.undoDeletePage(targetDocId, action.pageId);
      return { type: 'delete', pageId: action.pageId };
    } else if (action.type === 'reorder') {
      await this.#repository.reorderPages(targetDocId, action.priorOrder);
      return { type: 'reorder', priorOrder: action.priorOrder };
    }
    return action;
  }

  /**
   * Re-applies the most recently reverted operation on a document (CPO-045).
   * @param {string} docId
   * @returns {Promise<Object|null>}
   */
  async redo(docId) {
    const targetDocId = await this.#resolveDocId(docId);
    const stack = targetDocId ? this.#redoStack.get(targetDocId) : null;
    if (!stack || stack.length === 0) return null;
    const action = stack.pop();

    if (!this.#undoStack.has(targetDocId)) {
      this.#undoStack.set(targetDocId, []);
    }
    this.#undoStack.get(targetDocId).push(action);

    if (action.type === 'edit') {
      await this.updatePage(targetDocId, action.pageId, {
        edits: action.newEdits,
        src: action.newSrc,
      });
      return { type: 'edit', pageId: action.pageId, appliedEdits: action.newEdits };
    } else if (action.type === 'delete') {
      await this.deletePage(targetDocId, action.pageId);
      return { type: 'delete', pageId: action.pageId };
    } else if (action.type === 'reorder') {
      await this.reorderPages(targetDocId, action.newOrder);
      return { type: 'reorder', newOrder: action.newOrder };
    }
    return action;
  }

  subscribe(callback) {
    return this.#repository.subscribe(callback);
  }

  // --- Public Domain Methods & Use Cases (CPO-037) ---

  /**
   * Ingest and process an array of File or Blob objects, converting them to document pages.
   * Handles images (with EXIF extraction) and PDF files (rendering pages to data URLs).
   * 
   * @param {FileList|File[]|Blob[]} files
   * @param {string} [docId] - Target document ID (if omitted, attaches to latest or creates new doc)
   * @returns {Promise<Array<Object>>} Added page entities
   */
  async addFiles(files, docId = null) {
    if (!files || files.length === 0) return [];
    const fileList = Array.from(files);

    const newPages = [];

    for (const file of fileList) {
      if (file.type === 'application/pdf') {
        const pdfService = this.getService('pdf');
        if (pdfService && typeof pdfService.renderPdfPagesToDataUrls === 'function') {
          const rendered = await pdfService.renderPdfPagesToDataUrls(file);
          for (const dataUrl of rendered) {
            newPages.push({
              id: randomId(),
              src: dataUrl,
              originalSrc: dataUrl,
              edits: { crop: null, rotation: 0, filter: 'none' },
              type: 'image',
              name: /** @type {any} */ (file).name || 'PDF Page',
            });
          }
        } else {
          console.warn('PDF import service (PdfPort) not registered. Skipping PDF file.');
        }
      } else if (file.type && file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        let orientation = null;
        try {
          orientation = await extractExif(file);
        } catch {}

        newPages.push({
          id: randomId(),
          src: base64,
          originalSrc: base64,
          edits: { crop: null, rotation: 0, filter: 'none' },
          type: 'image',
          name: /** @type {any} */ (file).name || 'Captured Image',
          orientation,
        });
      }
    }

    if (newPages.length === 0) return [];

    let targetDocId = docId;
    if (!targetDocId) {
      const docs = await this.listDocuments();
      if (docs.length > 0) {
        targetDocId = docs[0].id;
      } else {
        const created = await this.createDocument('Scanned Document', []);
        targetDocId = created.id;
      }
    } else {
      const existing = await this.getDocument(targetDocId);
      if (!existing) {
        await this.#repository.saveDoc(targetDocId, { name: 'Scanned Document', pages: [] });
      }
    }

    // Check maxPages if configured
    if (this.#maxPages > 0) {
      const existing = (await this.getDocument(targetDocId))?.pages || [];
      const remainingSlots = Math.max(0, this.#maxPages - existing.length);
      if (remainingSlots <= 0) {
        throw new Error(`Maximum page limit (${this.#maxPages}) reached`);
      }
      newPages.splice(remainingSlots);
    }

    await this.addPages(targetDocId, newPages);
    return newPages;
  }

  /**
   * Get all pages for a document.
   * @param {string} [docId]
   * @returns {Promise<Array<Object>>}
   */
  async getPages(docId = null) {
    let targetDocId = docId;
    if (!targetDocId) {
      const docs = await this.listDocuments();
      if (docs.length === 0) return [];
      targetDocId = docs[0].id;
    }
    const doc = await this.getDocument(targetDocId);
    return doc?.pages || [];
  }

  /**
   * Clear all pages from a document.
   * @param {string} [docId]
   * @returns {Promise<void>}
   */
  async clear(docId = null) {
    let targetDocId = docId;
    if (!targetDocId) {
      const docs = await this.listDocuments();
      if (docs.length === 0) return;
      targetDocId = docs[0].id;
    }
    const doc = await this.getDocument(targetDocId);
    if (!doc || !doc.pages) return;
    for (const p of doc.pages) {
      await this.deletePage(targetDocId, p.id);
    }
  }

  /**
   * Resolve pages and document name from either doc ID, array of pages, or latest doc.
   */
  async #resolveDocAndPages(docIdOrPages) {
    if (Array.isArray(docIdOrPages)) {
      return { docName: 'document', pages: docIdOrPages, docId: null };
    }
    if (typeof docIdOrPages === 'string') {
      const doc = await this.getDocument(docIdOrPages);
      return {
        docName: doc?.name || 'document',
        pages: doc?.pages || [],
        docId: docIdOrPages,
      };
    }
    const docs = await this.listDocuments();
    if (docs.length > 0) {
      const doc = await this.getDocument(docs[0].id);
      return {
        docName: doc?.name || 'document',
        pages: doc?.pages || [],
        docId: docs[0].id,
      };
    }
    return { docName: 'document', pages: [], docId: null };
  }

  /**
   * Export document pages as a PDF Blob.
   * Does NOT trigger automatic browser download unless options.download === true.
   * 
   * @param {string|Array<Object>} [docIdOrPages]
   * @param {Object} [options]
   * @param {boolean} [options.download=false] - Whether to trigger browser download
   * @param {Function} [options.onProgress] - Progress callback (done, total)
   * @returns {Promise<Blob>}
   */
  async exportPdf(docIdOrPages, options = {}) {
    if (!this.hasFeature('export')) {
      const err = new Error('Feature "export" is disabled');
      Object.assign(err, { code: 'FEATURE_DISABLED' });
      throw err;
    }
    if (!this.#pdf || !this.#exportFormats.includes('pdf')) {
      const err = new Error('Feature "pdf" is disabled');
      Object.assign(err, { code: 'FEATURE_DISABLED' });
      throw err;
    }

    const { docName, pages } = await this.#resolveDocAndPages(docIdOrPages);
    const exportService = this.getService('pdf') || this.getService('export');
    if (!exportService || typeof exportService.exportDocumentAsPdf !== 'function') {
      throw new Error('Export service (PdfPort) is not registered. Import @copio/sdk or register an exportService.');
    }

    return exportService.exportDocumentAsPdf(docName, pages, {
      download: false,
      showProgress: false,
      ...options,
    });
  }

  /**
   * Export document pages as a ZIP (or single image) Blob.
   * Does NOT trigger automatic browser download unless options.download === true.
   * 
   * @param {string|Array<Object>} [docIdOrPages]
   * @param {Object} [options]
   * @param {boolean} [options.download=false] - Whether to trigger browser download
   * @param {Function} [options.onProgress] - Progress callback (done, total)
   * @returns {Promise<Blob>}
   */
  async exportZip(docIdOrPages, options = {}) {
    if (!this.hasFeature('export')) {
      const err = new Error('Feature "export" is disabled');
      Object.assign(err, { code: 'FEATURE_DISABLED' });
      throw err;
    }

    const { docName, pages } = await this.#resolveDocAndPages(docIdOrPages);
    const exportService = this.getService('export');
    if (!exportService || typeof exportService.exportDocumentAsImages !== 'function') {
      throw new Error('Export service is not registered. Import @copio/sdk or register an exportService.');
    }

    return exportService.exportDocumentAsImages(docName, pages, {
      download: false,
      showProgress: false,
      ...options,
    });
  }

  /**
   * Run optical character recognition on document pages.
   * 
   * @param {string|Array<Object>} [docIdOrPages]
   * @param {string} [pageId] - Optional specific page ID to recognize
   * @param {Object} [options]
   * @param {string} [options.lang] - OCR language (defaults to first configured language or 'eng')
   * @param {Function} [options.onPageProgress]
   * @returns {Promise<{ combinedText: string, text: string, pagesResults: Array<Object>, averageConfidence: number }>}
   */
  async runOcr(docIdOrPages, pageId = null, options = {}) {
    if (!this.#ocr || !this.hasFeature('ocr')) {
      const err = new Error('Feature "ocr" is disabled');
      Object.assign(err, { code: 'FEATURE_DISABLED' });
      throw err;
    }

    const { pages } = await this.#resolveDocAndPages(docIdOrPages);
    let targetPages = pages;
    if (pageId) {
      targetPages = pages.filter((p) => p.id === pageId);
    }

    const ocrService = this.getService('ocr');
    if (!ocrService || typeof ocrService.recognizeDocumentPages !== 'function') {
      throw new Error('OCR service (OcrPort) is not registered. Import @copio/sdk or register an ocrService.');
    }

    const lang = options.lang || this.#ocrLanguages[0] || 'eng';
    const result = await ocrService.recognizeDocumentPages(targetPages, {
      lang,
      ...options,
    });

    return {
      text: result.combinedText,
      ...result,
    };
  }

  /**
   * Initialize P2P synchronization session.
   * 
   * @param {Object} [options]
   * @param {Function} [options.onStateChange]
   * @returns {Promise<any>}
   */
  async sync(options = {}) {
    if (!this.hasFeature('sync')) {
      const err = new Error('Feature "sync" is disabled');
      Object.assign(err, { code: 'FEATURE_DISABLED' });
      throw err;
    }

    const SyncManagerClass = this.getService('sync');
    if (!SyncManagerClass) {
      throw new Error('Sync service (SyncPort) is not registered. Import @copio/sdk or register a syncService.');
    }

    return new SyncManagerClass(this.#repository, options.onStateChange);
  }
}

export {
  DocRepository,
  docRepository,
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  createDefaultAdapter,
  ImageProcessorPort,
  Canvas2DAdapter,
  NullImageProcessorAdapter,
  NullOcrAdapter,
  NullPdfAdapter,
  Document,
  Page,
  ScanSession,
  normalizeEditStack,
  hasActiveEdits,
  randomId,
  fileToBase64,
  thresholdSrc,
  rotateSrc,
  getCroppedSrc,
  extractExif,
  applyEdits,
  normalizeEdits,
  renderEditsToCanvas,
  applySauvolaToImageData,
  BUILD_DATE,
  VERSION,
};
