/**
 * StoragePort — Outbound/Driven Port for Data Persistence (Hexagonal Architecture / CPO-033).
 *
 * Defines the contract that all storage adapters (IndexedDB, Memory, OPFS, custom cloud)
 * must implement. Decouples the domain logic and UI from specific storage backends.
 */

/**
 * @typedef {Object} StorageInitResult
 * @property {string} kind - Adapter identifier ('memory' | 'indexeddb' | 'opfs' | string)
 * @property {boolean} persistent - Whether storage persists across page reloads/sessions
 */

/**
 * @typedef {Object} DocRow
 * @property {string} id - Unique document identifier
 * @property {string} name - Document title
 * @property {Array<any>|string} pages - Document pages array (or serialized JSON string in persistence layer)
 * @property {string} [createdAt] - Creation ISO timestamp
 * @property {string} [updatedAt] - Last modified ISO timestamp
 */

/**
 * Base interface / contract for StoragePort implementations.
 */
export class StoragePort {
  /**
   * Initializes the storage backend, opening connections and verifying availability.
   * @returns {Promise<StorageInitResult>}
   */
  async init() {
    throw new Error('StoragePort.init() must be implemented by adapter');
  }

  /**
   * Returns all stored documents.
   * @returns {Promise<DocRow[]>}
   */
  async listDocs() {
    throw new Error('StoragePort.listDocs() must be implemented by adapter');
  }

  /**
   * Retrieves a document by its ID.
   * @param {string} id
   * @returns {Promise<DocRow|null>}
   */
  async getDoc(id) {
    throw new Error('StoragePort.getDoc() must be implemented by adapter');
  }

  /**
   * Saves or updates a document.
   * @param {string} id
   * @param {DocRow} doc
   * @returns {Promise<void>}
   */
  async saveDoc(id, doc) {
    throw new Error('StoragePort.saveDoc() must be implemented by adapter');
  }

  /**
   * Deletes a document and its associated pages.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDoc(id) {
    throw new Error('StoragePort.deleteDoc() must be implemented by adapter');
  }

  /**
   * Saves page binary/data for a specific document.
   * @param {string} docId
   * @param {string} pageId
   * @param {any} blobOrData
   * @returns {Promise<void>}
   */
  async savePage(docId, pageId, blobOrData) {
    throw new Error('StoragePort.savePage() must be implemented by adapter');
  }

  /**
   * Retrieves page binary/data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<any>}
   */
  async getPage(docId, pageId) {
    throw new Error('StoragePort.getPage() must be implemented by adapter');
  }

  /**
   * Deletes page binary/data.
   * @param {string} docId
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  async deletePage(docId, pageId) {
    throw new Error('StoragePort.deletePage() must be implemented by adapter');
  }

  /**
   * Subscribes to storage changes (document modifications, additions, deletions).
   * @param {() => void} cb
   * @returns {() => void} Unsubscribe function
   */
  subscribe(cb) {
    return () => {};
  }
}
