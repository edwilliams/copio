import { StoragePort } from './storage-port.js';
import { store as defaultStore, persister as defaultPersister } from '../../core/store.js';
import { createStore } from '../../lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from '../../lib/tinybase-persister-indexed-db.js';
import { IndexedDbBlobStore } from './blob-store.js';

/**
 * Converts a base64 Data URL to a native Blob instance.
 * @param {any} dataUrlOrBlob
 * @param {string} [defaultType='image/jpeg']
 * @returns {Blob|null}
 */
export function dataUrlToBlob(dataUrlOrBlob, defaultType = 'image/jpeg') {
  if (dataUrlOrBlob instanceof Blob) return dataUrlOrBlob;
  if (typeof dataUrlOrBlob !== 'string' || !dataUrlOrBlob.startsWith('data:')) {
    return null;
  }
  const match = dataUrlOrBlob.match(/^data:([^;]+);base64,(.*)$/);
  const mime = match ? match[1] : defaultType;
  const b64 = match ? match[2] : dataUrlOrBlob.split(',')[1];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Converts a Blob to a Data URL (for backwards-compatibility / legacy fallbacks).
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * IndexedDbStorageAdapter — TinyBase IndexedDB implementation of StoragePort (CPO-033 / CPO-012).
 *
 * Implements fallback storage with metadata in TinyBase and binary page data stored
 * as native Blobs in an IndexedDB object store to avoid Base64 storage bloat.
 */
export class IndexedDbStorageAdapter extends StoragePort {
  #store = null;
  #persister = null;
  #blobStore = null;
  #dbName = 'copio-db';
  #isCustom = false;
  #objectUrls = new Set();
  #docObjectUrls = new Map();
  #pageObjectUrls = new Map();
  #pageOrigObjectUrls = new Map();
  #activeDocCache = new Map();

  /**
   * @param {Object} [options]
   * @param {any} [options.store] - Optional TinyBase store instance
   * @param {any} [options.persister] - Optional TinyBase persister instance
   * @param {string} [options.dbName] - Custom IndexedDB database name
   */
  constructor(options = {}) {
    super();

    if (options.dbName && options.dbName !== 'copio-db') {
      this.#dbName = options.dbName;
      this.#store = options.store || createStore();
      this.#store.setTable('docs', {});
      this.#persister = options.persister || createIndexedDbPersister(this.#store, this.#dbName);
      this.#isCustom = true;
    } else {
      this.#store = options.store || defaultStore;
      this.#persister = options.persister || defaultPersister;
      this.#dbName = 'copio-db';
    }

    this.#blobStore = new IndexedDbBlobStore(`${this.#dbName}-blobs`);
  }

  get store() {
    return this.#store;
  }

  get persister() {
    return this.#persister;
  }

  get blobStore() {
    return this.#blobStore;
  }

  /**
   * Tracks an object URL to ensure clean revocation on document disposal or adapter teardown.
   * @param {string} docId
   * @param {string} url
   * @returns {string}
   */
  #trackObjectUrl(docId, url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      this.#objectUrls.add(url);
      if (!this.#docObjectUrls.has(docId)) {
        this.#docObjectUrls.set(docId, []);
      }
      this.#docObjectUrls.get(docId).push(url);
    }
    return url;
  }

  /**
   * Revokes all active object URLs for a specific document.
   * @param {string} docId
   */
  revokeDocUrls(docId) {
    const urls = this.#docObjectUrls.get(docId);
    if (urls) {
      for (const url of urls) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        this.#objectUrls.delete(url);
      }
      this.#docObjectUrls.delete(docId);
    }
    for (const [key, url] of this.#pageObjectUrls.entries()) {
      if (key.startsWith(`${docId}:`)) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        this.#pageObjectUrls.delete(key);
      }
    }
    for (const [key, url] of this.#pageOrigObjectUrls.entries()) {
      if (key.startsWith(`${docId}:`)) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        this.#pageOrigObjectUrls.delete(key);
      }
    }
    this.#activeDocCache.delete(docId);
  }

  /**
   * Revokes all active object URLs created by this adapter.
   */
  revokeAllUrls() {
    for (const url of this.#objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.#objectUrls.clear();
    this.#docObjectUrls.clear();
    this.#pageObjectUrls.clear();
    this.#pageOrigObjectUrls.clear();
    this.#activeDocCache.clear();
  }

  /**
   * Initializes the storage backend, opening connections and verifying availability.
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    if (this.#isCustom) {
      await this.#persister.load();
      this.#persister.startAutoLoad();
      this.#persister.startAutoSave();
    } else {
      await this.#persister.load();
    }

    // Run startup sweep to remove orphan blobs left behind
    await this.sweepOrphans();

    let persistent = true;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        persistent = await navigator.storage.persisted();
      } catch {}
    }

    return {
      kind: 'indexeddb',
      persistent,
    };
  }

  /**
   * Startup sweep: removes any stored blobs whose document ID no longer exists.
   * @returns {Promise<number>}
   */
  async sweepOrphans() {
    const validDocIds = Object.keys(this.#store.getTable('docs') || {});
    return this.#blobStore.sweepOrphans(validDocIds);
  }

  /**
   * Returns list of all stored documents synchronously from the TinyBase cache.
   * @returns {Array<{ id: string, name: string, pages: any[] }>}
   */
  listDocsSync() {
    const table = this.#store.getTable('docs');
    return Object.entries(table || {}).map(([id, row]) => ({
      id,
      name: row.name || '',
      pages: this.#parsePages(row.pages),
    }));
  }

  /**
   * Returns list of all stored documents.
   * @returns {Promise<Array<{ id: string, name: string, pages: any[] }>>}
   */
  async listDocs() {
    return this.listDocsSync();
  }

  /**
   * Retrieves a document by its ID synchronously from the TinyBase cache or in-memory cache.
   * @param {string} id
   * @returns {{ id: string, name: string, pages: any[] } | null}
   */
  getDocSync(id) {
    if (this.#activeDocCache.has(id)) {
      return this.#activeDocCache.get(id);
    }
    if (!this.#store.hasRow('docs', id)) {
      return null;
    }

    const row = this.#store.getRow('docs', id);
    return {
      id,
      name: row.name || '',
      pages: this.#parsePages(row.pages),
    };
  }

  /**
   * Retrieves a document by its ID, rehydrating page Blobs and Object URLs.
   * @param {string} id
   * @returns {Promise<{ id: string, name: string, pages: any[] } | null>}
   */
  async getDoc(id) {
    if (!this.#store.hasRow('docs', id)) {
      return null;
    }
    const row = this.#store.getRow('docs', id);
    const parsedPages = this.#parsePages(row.pages);

    const rehydratedPages = await Promise.all(
      parsedPages.map(async (page) => {
        if (!page || page.type === 'markdown') return page;

        const copy = { ...page };
        const pageKey = `${id}:${page.id}`;
        const blob = await this.#blobStore.get(`${id}:${page.id}`);
        if (blob) {
          copy.blob = blob;
          if (this.#pageObjectUrls.has(pageKey)) {
            copy.src = this.#pageObjectUrls.get(pageKey);
          } else {
            copy.src = this.#trackObjectUrl(id, URL.createObjectURL(blob));
            this.#pageObjectUrls.set(pageKey, copy.src);
          }
        }

        const origKey = `${id}:${page.id}:orig`;
        const origBlob = await this.#blobStore.get(`${id}:${page.id}:original`);
        if (origBlob) {
          copy.originalBlob = origBlob;
          if (this.#pageOrigObjectUrls.has(origKey)) {
            copy.originalSrc = this.#pageOrigObjectUrls.get(origKey);
          } else {
            copy.originalSrc = this.#trackObjectUrl(id, URL.createObjectURL(origBlob));
            this.#pageOrigObjectUrls.set(origKey, copy.originalSrc);
          }
        } else if (copy.blob) {
          copy.originalBlob = copy.blob;
          copy.originalSrc = copy.src;
        }

        return copy;
      }),
    );

    const docObj = {
      id,
      name: row.name || '',
      pages: rehydratedPages,
    };
    this.#activeDocCache.set(id, docObj);
    return docObj;
  }

  /**
   * Saves or updates a document, persisting binary pages into native Blob storage
   * and clean metadata into TinyBase.
   * @param {string} id
   * @param {import('./storage-port.js').DocRow} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    if (!id) throw new Error('Cannot save document without an ID');

    const rawPages = Array.isArray(doc.pages)
      ? doc.pages
      : this.#parsePages(doc.pages);

    const cleanPages = [];
    const rehydratedPages = [];
    const pendingBlobs = [];

    for (const page of rawPages) {
      if (!page) continue;
      if (page.type === 'markdown') {
        cleanPages.push(page);
        rehydratedPages.push(page);
        continue;
      }

      let srcBlob = dataUrlToBlob(page.src) || (page.src instanceof Blob ? page.src : null) || (page.blob instanceof Blob ? page.blob : null);
      const mimeType = srcBlob?.type || 'image/jpeg';

      const cleanPage = {
        id: page.id,
        name: page.name || '',
        type: page.type || 'image',
        hasBlob: true,
        mimeType,
        edits: page.edits,
        exif: page.exif,
        content: page.content,
      };
      cleanPages.push(cleanPage);

      const pageKey = `${id}:${page.id}`;
      const origKey = `${id}:${page.id}:orig`;
      const rehydratedPage = { ...page };

      // Determine if page.src is a new/modified image (e.g. freshly edited data URL or new Blob)
      const currentSrcUrl = this.#pageObjectUrls.get(pageKey);
      const isNewSrc =
        (typeof page.src === 'string' && page.src.startsWith('data:')) ||
        page.src instanceof Blob ||
        (page.src && currentSrcUrl && page.src !== currentSrcUrl);

      if (srcBlob) {
        rehydratedPage.blob = srcBlob;
        if (isNewSrc || !currentSrcUrl) {
          if (currentSrcUrl) {
            try {
              URL.revokeObjectURL(currentSrcUrl);
            } catch {}
            this.#objectUrls.delete(currentSrcUrl);
          }
          const newUrl = this.#trackObjectUrl(id, URL.createObjectURL(srcBlob));
          this.#pageObjectUrls.set(pageKey, newUrl);
          rehydratedPage.src = newUrl;
        } else {
          rehydratedPage.src = currentSrcUrl;
        }
      }

      // Handle original page image:
      // If origBlob is not explicitly provided and originalSrc was not previously set or equal to src,
      // on the initial save the pristine original IS the initial srcBlob.
      let origBlob =
        dataUrlToBlob(page.originalSrc) ||
        (page.originalSrc instanceof Blob ? page.originalSrc : null) ||
        (page.originalBlob instanceof Blob ? page.originalBlob : null);

      const currentOrigUrl = this.#pageOrigObjectUrls.get(origKey);
      const isFirstOriginal = !currentOrigUrl && !origBlob && (!page.originalSrc || page.originalSrc === page.src);
      if (isFirstOriginal && srcBlob) {
        origBlob = srcBlob;
      }

      const isNewOrig =
        (typeof page.originalSrc === 'string' && page.originalSrc.startsWith('data:')) ||
        page.originalSrc instanceof Blob ||
        (isFirstOriginal && !!origBlob);

      if (origBlob) {
        rehydratedPage.originalBlob = origBlob;
        if (isNewOrig || !currentOrigUrl) {
          if (currentOrigUrl && isNewOrig) {
            try {
              URL.revokeObjectURL(currentOrigUrl);
            } catch {}
            this.#objectUrls.delete(currentOrigUrl);
          }
          const origUrl = this.#trackObjectUrl(id, URL.createObjectURL(origBlob));
          this.#pageOrigObjectUrls.set(origKey, origUrl);
          rehydratedPage.originalSrc = origUrl;
        } else {
          rehydratedPage.originalSrc = currentOrigUrl;
        }
      } else if (currentOrigUrl) {
        rehydratedPage.originalSrc = currentOrigUrl;
      } else if (page.originalSrc) {
        rehydratedPage.originalSrc = page.originalSrc;
      } else {
        rehydratedPage.originalSrc = rehydratedPage.src;
        if (rehydratedPage.blob) {
          rehydratedPage.originalBlob = rehydratedPage.blob;
        }
      }
      rehydratedPages.push(rehydratedPage);

      pendingBlobs.push({
        pageId: page.id,
        page,
        srcBlob,
        origBlob,
      });
    }

    // Synchronously update store and in-memory cache so UI updates immediately
    this.#store.setRow('docs', id, {
      name: doc.name || '',
      pages: JSON.stringify(cleanPages),
    });

    this.#activeDocCache.set(id, {
      id,
      name: doc.name || '',
      pages: rehydratedPages,
    });

    // Write binary blobs to IndexedDB
    for (const item of pendingBlobs) {
      let { pageId, page, srcBlob, origBlob } = item;
      if (!srcBlob && typeof page.src === 'string' && page.src.startsWith('blob:')) {
        try {
          const resp = await fetch(page.src);
          srcBlob = await resp.blob();
        } catch {}
      }
      if (srcBlob) {
        await this.#blobStore.put(`${id}:${pageId}`, srcBlob);
      }

      if (!origBlob && typeof page.originalSrc === 'string' && page.originalSrc.startsWith('blob:')) {
        try {
          const resp = await fetch(page.originalSrc);
          origBlob = await resp.blob();
        } catch {}
      }
      if (origBlob) {
        await this.#blobStore.put(`${id}:${pageId}:original`, origBlob);
      }
    }
  }

  /**
   * Deletes a document and its stored page Blobs.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDoc(id) {
    this.#store.delRow('docs', id);
    await this.#blobStore.deleteByPrefix(`${id}:`);
    this.revokeDocUrls(id);
    this.#activeDocCache.delete(id);
  }

  /**
   * Renames a document in TinyBase metadata and updates cache without rewriting blobs.
   * @param {string} id
   * @param {string} name
   * @returns {Promise<void>}
   */
  async renameDoc(id, name) {
    if (!this.#store.hasRow('docs', id)) {
      throw new Error(`Document "${id}" not found`);
    }
    this.#store.setCell('docs', id, 'name', name);
    if (this.#activeDocCache.has(id)) {
      this.#activeDocCache.get(id).name = name;
    }
  }

  /**
   * Saves page data for a document.
   * @param {string} docId
   * @param {string} pageId
   * @param {any} blobOrData
   * @returns {Promise<void>}
   */
  async savePage(docId, pageId, blobOrData) {
    const doc = await this.getDoc(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const idx = doc.pages.findIndex((p) => p.id === pageId);
    let targetPage;

    if (idx >= 0) {
      if (typeof blobOrData === 'object' && blobOrData !== null && !(blobOrData instanceof Blob)) {
        doc.pages[idx] = { ...doc.pages[idx], ...blobOrData };
      } else {
        doc.pages[idx] = { ...doc.pages[idx], src: blobOrData, blob: blobOrData instanceof Blob ? blobOrData : undefined };
      }
      targetPage = doc.pages[idx];
    } else {
      const pageObj =
        typeof blobOrData === 'object' && blobOrData !== null && !(blobOrData instanceof Blob)
          ? { id: pageId, ...blobOrData }
          : { id: pageId, src: blobOrData, blob: blobOrData instanceof Blob ? blobOrData : undefined };
      doc.pages.push(pageObj);
      targetPage = pageObj;
    }

    let blob = dataUrlToBlob(targetPage.src) || (targetPage.src instanceof Blob ? targetPage.src : null) || (targetPage.blob instanceof Blob ? targetPage.blob : null);
    if (!blob && typeof targetPage.src === 'string' && targetPage.src.startsWith('blob:')) {
      try {
        const resp = await fetch(targetPage.src);
        blob = await resp.blob();
      } catch {}
    }

    if (blob) {
      await this.#blobStore.put(`${docId}:${pageId}`, blob);
    }

    await this.saveDoc(docId, doc);
  }

  /**
   * Retrieves page binary Blob or data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<any>}
   */
  async getPage(docId, pageId) {
    const blob = await this.#blobStore.get(`${docId}:${pageId}`);
    if (blob) return blob;

    const doc = this.getDocSync(docId);
    if (!doc) return null;
    const page = doc.pages.find((p) => p.id === pageId);
    return page ? (page.content ?? page.src ?? page) : null;
  }

  /**
   * Deletes page binary Blob and metadata.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  async deletePage(docId, pageId) {
    const doc = this.getDocSync(docId);
    if (!doc) return;

    doc.pages = doc.pages.filter((p) => p.id !== pageId);
    this.#store.setRow('docs', docId, {
      name: doc.name || '',
      pages: JSON.stringify(doc.pages),
    });

    await this.#blobStore.delete(`${docId}:${pageId}`);
    await this.#blobStore.delete(`${docId}:${pageId}:original`);

    const pageKey = `${docId}:${pageId}`;
    if (this.#pageObjectUrls.has(pageKey)) {
      try {
        URL.revokeObjectURL(this.#pageObjectUrls.get(pageKey));
      } catch {}
      this.#pageObjectUrls.delete(pageKey);
    }
    const origKey = `${docId}:${pageId}:orig`;
    if (this.#pageOrigObjectUrls.has(origKey)) {
      try {
        URL.revokeObjectURL(this.#pageOrigObjectUrls.get(origKey));
      } catch {}
      this.#pageOrigObjectUrls.delete(origKey);
    }

    this.#activeDocCache.delete(docId);
  }

  /**
   * Subscribes to document changes via TinyBase table listener.
   * @param {() => void} cb
   * @returns {() => void} Unsubscribe function
   */
  subscribe(cb) {
    const listenerId = this.#store.addTableListener('docs', cb);
    return () => {
      this.#store.delListener(listenerId);
    };
  }

  #parsePages(rawPages) {
    if (Array.isArray(rawPages)) return rawPages;
    if (typeof rawPages === 'string') {
      try {
        return JSON.parse(rawPages);
      } catch {
        return [];
      }
    }
    return [];
  }
}
