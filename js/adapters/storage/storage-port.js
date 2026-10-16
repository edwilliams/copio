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
 * @property {string} [id] - Unique document identifier
 * @property {string} [name] - Document title
 * @property {Array<any>|string} [pages] - Document pages array (or serialized JSON string in persistence layer)
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
   * @param {string} _id
   * @returns {Promise<DocRow|null>}
   */
  async getDoc(_id) {
    throw new Error('StoragePort.getDoc() must be implemented by adapter');
  }

  /**
   * Saves or updates a document.
   * @param {string} _id
   * @param {DocRow} _doc
   * @returns {Promise<void>}
   */
  async saveDoc(_id, _doc) {
    throw new Error('StoragePort.saveDoc() must be implemented by adapter');
  }

  /**
   * Deletes a document and its associated pages.
   * @param {string} _id
   * @returns {Promise<void>}
   */
  async deleteDoc(_id) {
    throw new Error('StoragePort.deleteDoc() must be implemented by adapter');
  }

  /**
   * Saves page binary/data for a specific document.
   * @param {string} _docId
   * @param {string} _pageId
   * @param {any} _blobOrData
   * @returns {Promise<void>}
   */
  async savePage(_docId, _pageId, _blobOrData) {
    throw new Error('StoragePort.savePage() must be implemented by adapter');
  }

  /**
   * Retrieves page binary/data.
   * @param {string} _docId
   * @param {string} _pageId
   * @returns {Promise<any>}
   */
  async getPage(_docId, _pageId) {
    throw new Error('StoragePort.getPage() must be implemented by adapter');
  }

  /**
   * Deletes page binary/data.
   * @param {string} _docId
   * @param {string} _pageId
   * @returns {Promise<void>}
   */
  async deletePage(_docId, _pageId) {
    throw new Error('StoragePort.deletePage() must be implemented by adapter');
  }

  /**
   * Subscribes to storage changes (document modifications, additions, deletions).
   * @param {() => void} _cb
   * @returns {() => void} Unsubscribe function
   */
  subscribe(_cb) {
    return () => {};
  }
}
