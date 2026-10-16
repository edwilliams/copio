import { createDefaultAdapter } from '../adapters/storage/index.js';
import { randomId } from '../utils/utils.js';

/**
 * @typedef {Object} DocMetadata
 * @property {string} id - Document ID
 * @property {string} name - Document title
 * @property {number} pageCount - Number of pages in the document
 * @property {Array<any>} [pages] - Document pages
 */

/**
 * @typedef {Object} DocWithPages
 * @property {string} id - Document ID
 * @property {string} name - Document title
 * @property {Array<any>} pages - Document pages array
 */

/**
 * DocRepository — Headless Document Repository (Hexagonal Core / CPO-014).
 *
 * Encapsulates all document lifecycle and persistence logic behind a clean,
 * async API. Delegates storage to the configured StoragePort adapter and
 * eliminates direct store dependencies and JSON serialization from UI components.
 */
export class DocRepository {
  #adapter = null;

  /**
   * @param {import('../adapters/storage/storage-port.js').StoragePort} [adapter]
   */
  constructor(adapter = createDefaultAdapter()) {
    this.#adapter = adapter;
  }

  /**
   * Underlying StoragePort adapter.
   */
  get adapter() {
    return this.#adapter;
  }

  /**
   * Backward-compatibility accessor for the underlying TinyBase store (if available).
   */
  get store() {
    return this.#adapter?.store ?? null;
  }

  /**
   * Initializes the repository and underlying storage adapter.
   * @returns {Promise<{ kind: string, persistent: boolean }>}
   */
  async init() {
    return this.#adapter.init();
  }

  /**
   * Lists all documents with metadata synchronously if supported by adapter.
   * @returns {DocMetadata[]}
   */
  listDocsSync() {
    if (typeof this.#adapter.listDocsSync === 'function') {
      const rows = this.#adapter.listDocsSync();
      return rows.map((row) => {
        const pages = this.#normalizePages(row.pages);
        return {
          id: row.id,
          name: row.name || '',
          pageCount: pages.length,
          pages,
        };
      });
    }
    return [];
  }

  /**
   * Lists all documents with metadata (id, name, pageCount, pages).
   * @returns {Promise<DocMetadata[]>}
   */
  async listDocs() {
    const rows = await this.#adapter.listDocs();
    return rows.map((row) => {
      const pages = this.#normalizePages(row.pages);
      return {
        id: row.id,
        name: row.name || '',
        pageCount: pages.length,
        pages,
      };
    });
  }

  /**
   * Retrieves a document with its parsed pages array synchronously if supported.
   * @param {string} id
   * @returns {DocWithPages|null}
   */
  getDocSync(id) {
    if (!id) return null;
    if (typeof this.#adapter.getDocSync === 'function') {
      const row = this.#adapter.getDocSync(id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name || '',
        pages: this.#normalizePages(row.pages),
      };
    }
    const docs = this.listDocsSync();
    const doc = docs.find((d) => d.id === id);
    if (!doc) return null;
    return {
      id: doc.id,
      name: doc.name,
      pages: doc.pages || [],
    };
  }

  /**
   * Retrieves a document with its parsed pages array.
   * Returns null if not found.
   * @param {string} id
   * @returns {Promise<DocWithPages|null>}
   */
  async getDoc(id) {
    return this.getDocSync(id);
  }

  /**
   * Creates a new document with an optional title and initial pages.
   * @param {string} [name='Untitled Document']
   * @param {Array<any>} [pages=[]]
   * @returns {Promise<DocWithPages>}
   */
  async createDoc(name = 'Untitled Document', pages = []) {
    const id = randomId();
    const normalizedPages = this.#normalizePages(pages);
    const doc = {
      id,
      name: name || 'Untitled Document',
      pages: normalizedPages,
    };

    await this.#adapter.saveDoc(id, doc);
    return doc;
  }

  /**
   * Saves or updates an existing document.
   * @param {string} id
   * @param {{ name?: string, pages?: any[] }} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    if (!id) throw new Error('Cannot save document without an ID');

    const normalizedPages = this.#normalizePages(doc.pages);
    await this.#adapter.saveDoc(id, {
      id,
      name: doc.name || '',
      pages: normalizedPages,
    });
  }

  /**
   * Renames a document.
   * @param {string} id
   * @param {string} name
   * @returns {Promise<void>}
   */
  async renameDoc(id, name) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    doc.name = name;
    await this.saveDoc(id, doc);
  }

  /**
   * Deletes a document and its pages.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDoc(id) {
    if (!id) return;
    await this.#adapter.deleteDoc(id);
  }

  /**
   * Appends pages to an existing document.
   * @param {string} id
   * @param {Array<any>|any} pages
   * @returns {Promise<void>}
   */
  async addPages(id, pages) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const toAdd = Array.isArray(pages) ? pages : [pages];
    doc.pages.push(...toAdd);
    await this.saveDoc(id, doc);
  }

  /**
   * Updates an individual page within a document.
   * @param {string} id
   * @param {string} pageId
   * @param {Record<string, any>} updates
   * @returns {Promise<void>}
   */
  async updatePage(id, pageId, updates) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const pageIndex = doc.pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) {
      throw new Error(`Page "${pageId}" not found in document "${id}"`);
    }

    doc.pages[pageIndex] = {
      ...doc.pages[pageIndex],
      ...updates,
    };

    await this.saveDoc(id, doc);
  }

  /**
   * Reorders pages in a document according to an array of page IDs.
   * Any pages omitted from pageIds will be appended at the end.
   * @param {string} id
   * @param {string[]} pageIds
   * @returns {Promise<void>}
   */
  async reorderPages(id, pageIds) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    const pageMap = new Map(doc.pages.map((p) => [p.id, p]));
    const reordered = [];

    for (const pid of pageIds) {
      if (pageMap.has(pid)) {
        reordered.push(pageMap.get(pid));
        pageMap.delete(pid);
      }
    }

    // Retain any remaining pages
    for (const remaining of pageMap.values()) {
      reordered.push(remaining);
    }

    doc.pages = reordered;
    await this.saveDoc(id, doc);
  }

  /**
   * Deletes a page from a document.
   * @param {string} id
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  async deletePage(id, pageId) {
    const doc = await this.getDoc(id);
    if (!doc) throw new Error(`Document "${id}" not found`);

    doc.pages = doc.pages.filter((p) => p.id !== pageId);
    await this.saveDoc(id, doc);

    if (typeof this.#adapter.deletePage === 'function') {
      try {
        await this.#adapter.deletePage(id, pageId);
      } catch (err) {
        console.warn(`[DocRepository] Adapter deletePage error:`, err);
      }
    }
  }

  /**
   * Subscribes to document updates in storage.
   * @param {() => void} cb
   * @returns {() => void} Unsubscribe function
   */
  subscribe(cb) {
    return this.#adapter.subscribe(cb);
  }

  /**
   * Returns all documents as a dictionary indexed by id.
   * @returns {Promise<Record<string, DocWithPages>>}
   */
  async getAllDocs() {
    const docs = await this.listDocs();
    const result = {};
    for (const doc of docs) {
      result[doc.id] = doc;
    }
    return result;
  }

  /**
   * Exports all documents formatted for wire transmission (e.g. P2P sync).
   * @returns {Promise<Record<string, { name: string, pages: string }>>}
   */
  async exportAll() {
    const docs = await this.listDocs();
    const result = {};
    for (const doc of docs) {
      result[doc.id] = {
        name: doc.name,
        pages: JSON.stringify(doc.pages),
      };
    }
    return result;
  }

  /**
   * Imports multiple documents from wire/raw format (e.g. from P2P sync).
   * @param {Record<string, any>} docsMap
   * @returns {Promise<number>} Count of newly added documents
   */
  async importDocs(docsMap) {
    let added = 0;
    for (const [id, row] of Object.entries(docsMap || {})) {
      const existing = await this.getDoc(id);
      if (!existing) added++;

      const pages = this.#normalizePages(row.pages);
      await this.saveDoc(id, {
        name: row.name || '',
        pages,
      });
    }
    return added;
  }

  #normalizePages(rawPages) {
    if (Array.isArray(rawPages)) return [...rawPages];
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

/**
 * Singleton repository instance using default storage.
 */
export const docRepository = new DocRepository();
