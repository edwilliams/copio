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
  hasActiveEdits,
  renderEditsToCanvas,
  applySauvolaToImageData,
} from '../js/utils/utils.js';
import { setAssetBase, getAssetBase } from '../js/utils/module-loader.js';
import { BUILD_DATE, VERSION } from './version.js';

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

  /**
   * @param {Object} [options]
   * @param {StoragePort} [options.storage] - Persistence adapter implementing StoragePort
   * @param {DocRepository} [options.repository] - Headless document repository instance
   * @param {Object} [options.services] - Custom driven adapters ({ export, ocr, sync, pdf })
   * @param {string|string[]} [options.features] - Enabled feature set ('crop rotate filter ocr export sync')
   * @param {string|string[]} [options.exportFormats] - Supported export formats ('pdf', 'zip', 'png', 'jpg')
   * @param {string|string[]} [options.ocrLanguages] - Configured OCR languages ('eng', 'deu', etc.)
   * @param {number} [options.maxPages=0] - Maximum allowed pages (0 = unlimited)
   * @param {string} [options.assetBase] - Base URL for lazy-loaded assets and workers
   * @param {string} [options.licenseKey] - SDK commercial license key
   */
  constructor(options = {}) {
    this.#storage = options.storage || createDefaultAdapter(/** @type {any} */ (options));
    this.#repository = options.repository || new DocRepository(this.#storage);

    if (options.services) {
      this.#services = { ...options.services };
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
  }

  /**
   * Enable a specific feature.
   * @param {string} featureName
   */
  enableFeature(featureName) {
    if (featureName) {
      this.#features.add(String(featureName).trim().toLowerCase());
    }
  }

  /**
   * Disable a specific feature.
   * @param {string} featureName
   */
  disableFeature(featureName) {
    if (featureName) {
      this.#features.delete(String(featureName).trim().toLowerCase());
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

  async deleteDocument(id, options) {
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

  async deletePage(id, pageId, options) {
    return this.#repository.deletePage(id, pageId, options);
  }

  async undoDeletePage(id, pageId) {
    return this.#repository.undoDeletePage(id, pageId);
  }

  async updatePage(id, pageId, updates) {
    return this.#repository.updatePage(id, pageId, updates);
  }

  async reorderPages(id, pageIds) {
    return this.#repository.reorderPages(id, pageIds);
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

    const { docName, pages } = await this.#resolveDocAndPages(docIdOrPages);
    const exportService = this.getService('export');
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
    if (!this.hasFeature('ocr')) {
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
  randomId,
  fileToBase64,
  thresholdSrc,
  rotateSrc,
  getCroppedSrc,
  extractExif,
  applyEdits,
  normalizeEdits,
  hasActiveEdits,
  renderEditsToCanvas,
  applySauvolaToImageData,
  BUILD_DATE,
  VERSION,
};
