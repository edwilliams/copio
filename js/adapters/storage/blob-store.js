// SPDX-License-Identifier: AGPL-3.0
/**
 * IndexedDbBlobStore — Native Blob persistence helper for IndexedDbStorageAdapter (CPO-012).
 *
 * Eliminates Base64 encoding overhead by storing binary page Blobs directly
 * inside a dedicated IndexedDB object store ('copio-blobs').
 */
export class IndexedDbBlobStore {
  #dbName;
  #storeName = 'blobs';
  #dbPromise = null;

  /**
   * @param {string} [dbName='copio-blobs']
   */
  constructor(dbName = 'copio-blobs') {
    this.#dbName = dbName;
  }

  async #getDb() {
    if (this.#dbPromise) return this.#dbPromise;

    this.#dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const req = indexedDB.open(this.#dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.#storeName)) {
          db.createObjectStore(this.#storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open blob db'));
    });
    return this.#dbPromise;
  }

  /**
   * Saves a native Blob under the given key.
   * @param {string} key
   * @param {Blob} blob
   * @returns {Promise<void>}
   */
  async put(key, blob) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.#storeName, 'readwrite');
      const store = tx.objectStore(this.#storeName);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves a native Blob by key.
   * @param {string} key
   * @returns {Promise<Blob|null>}
   */
  async get(key) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.#storeName, 'readonly');
      const store = tx.objectStore(this.#storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Deletes a Blob by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async delete(key) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.#storeName, 'readwrite');
      const store = tx.objectStore(this.#storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Deletes all Blobs whose key starts with the given prefix (e.g. `${docId}:`).
   * @param {string} prefix
   * @returns {Promise<void>}
   */
  async deleteByPrefix(prefix) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.#storeName, 'readwrite');
      const store = tx.objectStore(this.#storeName);
      const req = store.openKeyCursor();
      req.onsuccess = (e) => {
        const cursor = /** @type {IDBRequest} */ (e.target).result;
        if (cursor) {
          if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
            store.delete(cursor.key);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Startup sweep: removes any stored Blobs whose docId prefix is not in validDocIds.
   * @param {string[]|Set<string>} validDocIds
   * @returns {Promise<number>} Count of removed orphan blobs
   */
  async sweepOrphans(validDocIds) {
    const validSet = new Set(validDocIds);
    const db = await this.#getDb();
    let removedCount = 0;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.#storeName, 'readwrite');
      const store = tx.objectStore(this.#storeName);
      const req = store.openKeyCursor();
      req.onsuccess = (e) => {
        const cursor = /** @type {IDBRequest} */ (e.target).result;
        if (cursor) {
          if (typeof cursor.key === 'string') {
            const docId = cursor.key.split(':')[0];
            if (!validSet.has(docId)) {
              store.delete(cursor.key);
              removedCount++;
            }
          }
          cursor.continue();
        } else {
          resolve(removedCount);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Closes the database connection.
   */
  async close() {
    if (this.#dbPromise) {
      try {
        const db = await this.#dbPromise;
        db.close();
      } catch {}
      this.#dbPromise = null;
    }
  }
}
