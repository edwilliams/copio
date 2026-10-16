import { StoragePort } from './storage-port.js';

/**
 * MemoryStorageAdapter — In-memory implementation of StoragePort (CPO-033).
 *
 * Useful for headless testing, Node.js environments, temporary scans,
 * and ephemeral SDK use-cases without browser storage.
 */
export class MemoryStorageAdapter extends StoragePort {
  /** @type {Map<string, { id: string, name: string, pages: any[] }>} */
  #docs = new Map();

  /** @type {Map<string, any>} key: `${docId}/${pageId}` */
  #pages = new Map();

  /** @type {Set<() => void>} */
  #subscribers = new Set();

  constructor() {
    super();
  }

  /**
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    return {
      kind: 'memory',
      persistent: false,
    };
  }

  /**
   * Returns list of all stored documents synchronously.
   * @returns {Array<{ id: string, name: string, pages: any[] }>}
   */
  listDocsSync() {
    return Array.from(this.#docs.values()).map((doc) => ({
      id: doc.id,
      name: doc.name,
      pages: Array.isArray(doc.pages) ? [...doc.pages] : [],
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
   * Retrieves a document by its ID synchronously.
   * @param {string} id
   * @returns {{ id: string, name: string, pages: any[] } | null}
   */
  getDocSync(id) {
    const doc = this.#docs.get(id);
    if (!doc) return null;
    return {
      id: doc.id,
      name: doc.name,
      pages: Array.isArray(doc.pages) ? [...doc.pages] : [],
    };
  }

  /**
   * Retrieves a document by its ID.
   * @param {string} id
   * @returns {Promise<{ id: string, name: string, pages: any[] } | null>}
   */
  async getDoc(id) {
    return this.getDocSync(id);
  }

  /**
   * Saves or updates a document.
   * @param {string} id
   * @param {import('./storage-port.js').DocRow} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    if (!id) throw new Error('Cannot save document without an ID');

    let pages = [];
    if (Array.isArray(doc.pages)) {
      pages = [...doc.pages];
    } else if (typeof doc.pages === 'string') {
      try {
        pages = JSON.parse(doc.pages);
      } catch {
        pages = [];
      }
    }

    this.#docs.set(id, {
      id,
      name: doc.name || '',
      pages,
    });

    this.#notify();
  }

  /**
   * Deletes a document and its pages.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDoc(id) {
    this.#docs.delete(id);

    // Delete associated pages
    const prefix = `${id}/`;
    for (const key of this.#pages.keys()) {
      if (key.startsWith(prefix)) {
        this.#pages.delete(key);
      }
    }

    this.#notify();
  }

  /**
   * Saves page data for a document.
   * @param {string} docId
   * @param {string} pageId
   * @param {any} blobOrData
   * @returns {Promise<void>}
   */
  async savePage(docId, pageId, blobOrData) {
    this.#pages.set(`${docId}/${pageId}`, blobOrData);

    // If document exists, sync into doc.pages if page object is present
    const doc = this.#docs.get(docId);
    if (doc) {
      const idx = doc.pages.findIndex((p) => p.id === pageId);
      if (idx >= 0) {
        if (typeof blobOrData === 'object' && blobOrData !== null && !(blobOrData instanceof Blob)) {
          doc.pages[idx] = { ...doc.pages[idx], ...blobOrData };
        } else {
          doc.pages[idx] = { ...doc.pages[idx], src: blobOrData };
        }
      } else {
        const pageObj =
          typeof blobOrData === 'object' && blobOrData !== null && !(blobOrData instanceof Blob)
            ? { id: pageId, ...blobOrData }
            : { id: pageId, src: blobOrData };
        doc.pages.push(pageObj);
      }
    }

    this.#notify();
  }

  /**
   * Retrieves page data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<any>}
   */
  async getPage(docId, pageId) {
    if (this.#pages.has(`${docId}/${pageId}`)) {
      return this.#pages.get(`${docId}/${pageId}`);
    }

    const doc = this.#docs.get(docId);
    if (doc) {
      const page = doc.pages.find((p) => p.id === pageId);
      if (page) return page.src ?? page;
    }

    return null;
  }

  /**
   * Deletes page data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  async deletePage(docId, pageId) {
    this.#pages.delete(`${docId}/${pageId}`);

    const doc = this.#docs.get(docId);
    if (doc) {
      doc.pages = doc.pages.filter((p) => p.id !== pageId);
    }

    this.#notify();
  }

  /**
   * Subscribes to document changes.
   * @param {() => void} cb
   * @returns {() => void}
   */
  subscribe(cb) {
    this.#subscribers.add(cb);
    return () => {
      this.#subscribers.delete(cb);
    };
  }

  /**
   * Clears all in-memory data (useful for test isolation).
   */
  clear() {
    this.#docs.clear();
    this.#pages.clear();
    this.#notify();
  }

  #notify() {
    for (const subscriber of this.#subscribers) {
      try {
        subscriber();
      } catch (err) {
        console.error('Error in MemoryStorageAdapter subscriber:', err);
      }
    }
  }
}
