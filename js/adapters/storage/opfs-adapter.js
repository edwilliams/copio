import { StoragePort } from './storage-port.js';
import { store as defaultStore } from '../../core/store.js';
import { createStore } from '../../lib/tinybase.6.5.2.js';
import { IndexedDbStorageAdapter, dataUrlToBlob } from './indexeddb-adapter.js';

/**
 * Feature detection and write/read/delete probe for Origin Private File System (OPFS).
 * Returns true only if OPFS is available and writable.
 * @returns {Promise<boolean>}
 */
export async function probeOpfs() {
  if (
    typeof location !== 'undefined' &&
    location.search &&
    (new URLSearchParams(location.search).has('no-opfs') ||
     new URLSearchParams(location.search).get('storage') === 'indexeddb')
  ) {
    return false;
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return false;
  }

  try {
    const root = await navigator.storage.getDirectory();
    if (!root) return false;

    // Test file operations (some private browsing modes expose the API but throw on access)
    const probeName = `.copio-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    const fileHandle = await root.getFileHandle(probeName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Uint8Array([1, 2, 3, 4]));
    await writable.close();

    const file = await fileHandle.getFile();
    if (file.size !== 4) {
      throw new Error('OPFS probe size mismatch');
    }

    await root.removeEntry(probeName);
    return true;
  } catch {
    return false;
  }
}

/**
 * TinyBase persister that saves and loads the store to/from a JSON file in an OPFS directory.
 * @param {any} store - TinyBase store instance
 * @param {() => FileSystemDirectoryHandle|null} getCopioDir - Function returning OPFS directory handle
 * @param {string} [fileName='store.json']
 */
export function createOpfsPersister(store, getCopioDir, fileName = 'store.json') {
  let status = 0; // 0 = idle, 1 = loading, 2 = saving
  let didFinishListener = null;
  let saveQueue = Promise.resolve();
  let pendingSaves = 0;

  const getDir = () => (typeof getCopioDir === 'function' ? getCopioDir() : getCopioDir);

  const load = async () => {
    // Await any active saves before loading
    await saveQueue;
    const dir = getDir();
    if (!dir) return;
    status = 1;
    try {
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      if (text && text.trim().length > 0) {
        store.setJson(text);
      }
    } catch {
      // File does not exist yet; fresh start
    } finally {
      status = 0;
    }
  };

  const save = () => {
    const dir = getDir();
    if (!dir) return Promise.resolve();

    pendingSaves++;
    status = 2;

    saveQueue = saveQueue
      .catch(() => {}) // don't break queue on previous errors
      .then(async () => {
        try {
          const json = store.getJson();
          const fileHandle = await dir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(json);
          await writable.close();
        } catch (err) {
          console.warn('[OpfsPersister] Failed to save store.json:', err);
        } finally {
          pendingSaves--;
          if (pendingSaves <= 0) {
            pendingSaves = 0;
            status = 0;
          }
        }
      });

    return saveQueue;
  };

  const startAutoSave = () => {
    if (didFinishListener) return;
    didFinishListener = store.addDidFinishTransactionListener(() => {
      save();
    });
  };

  const stopAutoSave = () => {
    if (didFinishListener) {
      store.delListener(didFinishListener);
      didFinishListener = null;
    }
  };

  return {
    load,
    save,
    startAutoSave,
    stopAutoSave,
    getStatus: () => status,
    getStore: () => store,
  };
}

/**
 * Helper to safely iterate directory entries across browser implementations.
 * @param {FileSystemDirectoryHandle} dirHandle
 * @returns {Promise<Array<[string, FileSystemHandle]>>}
 */
async function getDirectoryEntries(dirHandle) {
  const entries = [];
  try {
    if (typeof dirHandle.entries === 'function') {
      for await (const entry of dirHandle.entries()) {
        entries.push(entry);
      }
    } else if (typeof dirHandle.values === 'function') {
      for await (const handle of dirHandle.values()) {
        entries.push([handle.name, handle]);
      }
    }
  } catch (err) {
    console.warn('[OpfsAdapter] Error reading directory entries:', err);
  }
  return entries;
}

/**
 * OpfsStorageAdapter — Primary OPFS implementation of StoragePort (CPO-012).
 *
 * Stores metadata in TinyBase persisted to `copio/store.json`, and page binary data
 * as individual files in `copio/docs/{docId}/{pageId}.bin` in the Origin Private File System.
 * Falls back to IndexedDbStorageAdapter if OPFS is unavailable or unsupported.
 */
export class OpfsStorageAdapter extends StoragePort {
  #options;
  #dirName = 'copio';
  #rootDir = null;
  #copioDir = null;
  #docsDir = null;
  #store = null;
  #persister = null;
  #isFallback = false;
  #fallbackAdapter = null;
  #objectUrls = new Set();
  #docObjectUrls = new Map();
  #pageObjectUrls = new Map();
  #pageOrigObjectUrls = new Map();
  #activeDocCache = new Map();
  #initPromise = null;

  /**
   * @param {Object} [options]
   * @param {string} [options.dirName='copio'] - Root subfolder name in OPFS
   * @param {any} [options.store] - Optional TinyBase store instance
   * @param {boolean} [options.forceFallback=false] - Force fallback to IndexedDB
   * @param {string} [options.dbName] - IndexedDB database name for fallback
   * @param {any} [options.persister] - Optional TinyBase persister instance
   */
  constructor(options = {}) {
    super();
    this.#options = options;
    this.#dirName = options.dirName || 'copio';

    if (options.store) {
      this.#store = options.store;
    } else if (options.dirName && options.dirName !== 'copio') {
      this.#store = createStore();
      this.#store.setTable('docs', {});
    } else {
      this.#store = defaultStore;
    }

    this.#persister = options.persister || createOpfsPersister(this.#store, () => this.#copioDir, 'store.json');
  }

  get store() {
    return this.#isFallback ? this.#fallbackAdapter?.store : this.#store;
  }

  get persister() {
    return this.#isFallback ? this.#fallbackAdapter?.persister : this.#persister;
  }

  get isFallback() {
    return this.#isFallback;
  }

  get fallbackAdapter() {
    return this.#fallbackAdapter;
  }

  async #ensureDirs() {
    if (this.#isFallback) return false;
    if (this.#docsDir && this.#copioDir) return true;

    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      try {
        this.#rootDir = await navigator.storage.getDirectory();
        this.#copioDir = await this.#rootDir.getDirectoryHandle(this.#dirName, { create: true });
        this.#docsDir = await this.#copioDir.getDirectoryHandle('docs', { create: true });
        return true;
      } catch (err) {
        console.warn('[OpfsAdapter] OPFS directory access failed, switching to fallback:', err);
        await this.#activateFallback();
        return false;
      }
    } else {
      await this.#activateFallback();
      return false;
    }
  }

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
   * Revokes all active object URLs for a given document.
   * @param {string} docId
   */
  revokeDocUrls(docId) {
    if (this.#isFallback) {
      this.#fallbackAdapter?.revokeDocUrls(docId);
      return;
    }
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
    if (this.#isFallback) {
      this.#fallbackAdapter?.revokeAllUrls();
      return;
    }
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
   * Initializes the OPFS storage backend, performing a probe test and running startup sweeps.
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    if (this.#initPromise) {
      return this.#initPromise;
    }
    this.#initPromise = (async () => {
      if (this.#options.forceFallback) {
        return this.#activateFallback();
      }

      const supported = await probeOpfs();
      if (!supported) {
        return this.#activateFallback();
      }

      try {
        await this.#ensureDirs();
        await this.#persister.load();
        this.#persister.startAutoSave();

        // Clean up orphaned directories and files left behind
        await this.sweepOrphans();

        let persistent = false;
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
          try {
            persistent = await navigator.storage.persisted();
          } catch {}
        }

        return {
          kind: 'opfs',
          persistent,
        };
      } catch (err) {
        console.warn('[OpfsAdapter] OPFS initialization failed, switching to IndexedDB fallback:', err);
        return this.#activateFallback();
      }
    })();
    return this.#initPromise;
  }

  async #activateFallback() {
    this.#isFallback = true;
    this.#fallbackAdapter = new IndexedDbStorageAdapter(this.#options);
    const result = await this.#fallbackAdapter.init();
    return {
      kind: 'indexeddb',
      persistent: result.persistent,
    };
  }

  /**
   * Startup sweep: removes any stored doc directories or page files that are no longer
   * referenced in TinyBase metadata.
   * @returns {Promise<number>} Count of removed orphan files and directories
   */
  async sweepOrphans() {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.sweepOrphans();
    }
    await this.#ensureDirs();
    if (!this.#docsDir) return 0;

    let removed = 0;
    const docsTable = this.#store.getTable('docs') || {};
    const validDocIds = new Set(Object.keys(docsTable));
    const validPageIdsByDoc = new Map();

    for (const [id, row] of Object.entries(docsTable)) {
      const pages = this.#parsePages(row.pages);
      validPageIdsByDoc.set(id, new Set(pages.map((p) => p.id)));
    }

    const docEntries = await getDirectoryEntries(this.#docsDir);
    for (const [name, handle] of docEntries) {
      if (handle.kind === 'directory') {
        if (!validDocIds.has(name)) {
          try {
            await this.#docsDir.removeEntry(name, { recursive: true });
            removed++;
          } catch {}
        } else {
          // Check for orphan page files within the valid doc directory
          const validPageIds = validPageIdsByDoc.get(name) || new Set();
          const docDir = /** @type {FileSystemDirectoryHandle} */ (handle);
          const fileEntries = await getDirectoryEntries(docDir);
          for (const [fileName] of fileEntries) {
            const baseId = fileName.replace(/-original\.bin$/, '').replace(/\.bin$/, '');
            if (!validPageIds.has(baseId)) {
              try {
                await docDir.removeEntry(fileName);
                removed++;
              } catch {}
            }
          }
        }
      }
    }

    return removed;
  }

  /**
   * Returns list of all stored documents synchronously from TinyBase metadata.
   * @returns {Array<{ id: string, name: string, pages: any[] }>}
   */
  listDocsSync() {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.listDocsSync();
    }
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
    if (this.#isFallback) {
      return this.#fallbackAdapter?.listDocs();
    }
    return this.listDocsSync();
  }

  /**
   * Retrieves a document by its ID synchronously from TinyBase metadata or in-memory cache.
   * @param {string} id
   * @returns {{ id: string, name: string, pages: any[] } | null}
   */
  getDocSync(id) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.getDocSync(id);
    }
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
   * Retrieves a document by its ID, rehydrating page Blobs and Object URLs from OPFS.
   * @param {string} id
   * @returns {Promise<{ id: string, name: string, pages: any[] } | null>}
   */
  async getDoc(id) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.getDoc(id);
    }
    await this.#ensureDirs();

    if (!this.#store.hasRow('docs', id)) {
      return null;
    }
    const row = this.#store.getRow('docs', id);
    const parsedPages = this.#parsePages(row.pages);

    let docDir = null;
    if (this.#docsDir) {
      try {
        docDir = await this.#docsDir.getDirectoryHandle(id);
      } catch {}
    }

    const rehydratedPages = await Promise.all(
      parsedPages.map(async (page) => {
        if (!page || !docDir) return page;

        const copy = { ...page };
        const pageKey = `${id}:${page.id}`;
        try {
          const fileHandle = await docDir.getFileHandle(`${page.id}.bin`);
          const file = await fileHandle.getFile();
          copy.blob = file;
          if (this.#pageObjectUrls.has(pageKey)) {
            copy.src = this.#pageObjectUrls.get(pageKey);
          } else {
            copy.src = this.#trackObjectUrl(id, URL.createObjectURL(file));
            this.#pageObjectUrls.set(pageKey, copy.src);
          }
        } catch {}

        const origKey = `${id}:${page.id}:orig`;
        try {
          const origHandle = await docDir.getFileHandle(`${page.id}-original.bin`);
          const origFile = await origHandle.getFile();
          copy.originalBlob = origFile;
          if (this.#pageOrigObjectUrls.has(origKey)) {
            copy.originalSrc = this.#pageOrigObjectUrls.get(origKey);
          } else {
            copy.originalSrc = this.#trackObjectUrl(id, URL.createObjectURL(origFile));
            this.#pageOrigObjectUrls.set(origKey, copy.originalSrc);
          }
        } catch {
          if (copy.blob) {
            copy.originalBlob = copy.blob;
            copy.originalSrc = copy.src;
          }
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
   * Saves or updates a document, writing binary pages as files to OPFS
   * and clean metadata into TinyBase.
   * @param {string} id
   * @param {import('./storage-port.js').DocRow} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.saveDoc(id, doc);
    }
    if (!id) throw new Error('Cannot save document without an ID');

    const rawPages = Array.isArray(doc.pages)
      ? doc.pages
      : this.#parsePages(doc.pages);

    const cleanPages = [];
    const rehydratedPages = [];
    const blobTasks = [];

    for (const page of rawPages) {
      if (!page) continue;

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
        ocrText: page.ocrText ?? null,
        ocrConfidence: page.ocrConfidence ?? null,
        ocrWords: Array.isArray(page.ocrWords) ? page.ocrWords : null,
        ocrWidth: page.ocrWidth ?? null,
        ocrHeight: page.ocrHeight ?? null,
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

      blobTasks.push({
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

    // Write binary pages to OPFS
    await this.#ensureDirs();
    if (this.#isFallback) {
      return this.#fallbackAdapter?.saveDoc(id, doc);
    }

    let docDir = null;
    if (this.#docsDir) {
      try {
        docDir = await this.#docsDir.getDirectoryHandle(id, { create: true });
      } catch (err) {
        console.warn(`[OpfsAdapter] Failed to get doc directory "${id}":`, err);
      }
    }

    if (docDir) {
      for (const task of blobTasks) {
        let { pageId, page, srcBlob, origBlob } = task;

        if (!srcBlob && typeof page.src === 'string' && page.src.startsWith('blob:')) {
          try {
            const resp = await fetch(page.src);
            srcBlob = await resp.blob();
          } catch {}
        }

        if (srcBlob) {
          try {
            const fileHandle = await docDir.getFileHandle(`${pageId}.bin`, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(srcBlob);
            await writable.close();
          } catch (err) {
            console.warn(`[OpfsAdapter] Failed writing page file "${pageId}.bin":`, err);
          }
        }

        if (!origBlob && typeof page.originalSrc === 'string' && page.originalSrc.startsWith('blob:')) {
          try {
            const resp = await fetch(page.originalSrc);
            origBlob = await resp.blob();
          } catch {}
        }

        // Always save original if available so pristine capture is never lost
        if (origBlob) {
          try {
            const origHandle = await docDir.getFileHandle(`${pageId}-original.bin`, { create: true });
            const writable = await origHandle.createWritable();
            await writable.write(origBlob);
            await writable.close();
          } catch {
            // Ephemeral or detached File handle; ignore gracefully
          }
        }
      }
    }
  }

  /**
   * Deletes a document, removing its folder in OPFS and its row from TinyBase.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDoc(id) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.deleteDoc(id);
    }

    // Synchronously remove from store and cache so UI updates immediately
    this.#store.delRow('docs', id);
    this.#activeDocCache.delete(id);
    this.revokeDocUrls(id);

    await this.#ensureDirs();
    if (this.#docsDir) {
      try {
        await this.#docsDir.removeEntry(id, { recursive: true });
      } catch {}
    }
  }

  /**
   * Renames a document in TinyBase metadata and updates cache without rewriting page binaries.
   * @param {string} id
   * @param {string} name
   * @returns {Promise<void>}
   */
  async renameDoc(id, name) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.renameDoc(id, name);
    }
    if (!this.#store.hasRow('docs', id)) {
      throw new Error(`Document "${id}" not found`);
    }
    this.#store.setCell('docs', id, 'name', name);
    if (this.#activeDocCache.has(id)) {
      this.#activeDocCache.get(id).name = name;
    }
  }

  /**
   * Saves page binary data or metadata for a document.
   * @param {string} docId
   * @param {string} pageId
   * @param {any} blobOrData
   * @returns {Promise<void>}
   */
  async savePage(docId, pageId, blobOrData) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.savePage(docId, pageId, blobOrData);
    }
    await this.#ensureDirs();

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

    if (blob && this.#docsDir) {
      try {
        const docDir = await this.#docsDir.getDirectoryHandle(docId, { create: true });
        const fileHandle = await docDir.getFileHandle(`${pageId}.bin`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err) {
        console.warn(`[OpfsAdapter] Failed writing page file "${pageId}.bin":`, err);
      }
    }

    await this.saveDoc(docId, doc);
  }

  /**
   * Retrieves page binary Blob or data from OPFS.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<any>}
   */
  async getPage(docId, pageId) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.getPage(docId, pageId);
    }
    await this.#ensureDirs();

    if (this.#docsDir) {
      try {
        const docDir = await this.#docsDir.getDirectoryHandle(docId);
        const fileHandle = await docDir.getFileHandle(`${pageId}.bin`);
        return await fileHandle.getFile();
      } catch {}
    }

    const doc = this.getDocSync(docId);
    if (!doc) return null;
    const page = doc.pages.find((p) => p.id === pageId);
    return page ? (page.content ?? page.src ?? page) : null;
  }

  /**
   * Deletes a page file from OPFS and removes it from TinyBase metadata.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  async deletePage(docId, pageId) {
    if (this.#isFallback) {
      return this.#fallbackAdapter?.deletePage(docId, pageId);
    }
    await this.#ensureDirs();

    const doc = this.getDocSync(docId);
    if (!doc) return;

    doc.pages = doc.pages.filter((p) => p.id !== pageId);
    this.#store.setRow('docs', docId, {
      name: doc.name || '',
      pages: JSON.stringify(doc.pages),
    });

    if (this.#docsDir) {
      try {
        const docDir = await this.#docsDir.getDirectoryHandle(docId);
        await docDir.removeEntry(`${pageId}.bin`);
      } catch {}
      try {
        const docDir = await this.#docsDir.getDirectoryHandle(docId);
        await docDir.removeEntry(`${pageId}-original.bin`);
      } catch {}
    }

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
    if (this.#isFallback) {
      return this.#fallbackAdapter?.subscribe(cb);
    }
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
