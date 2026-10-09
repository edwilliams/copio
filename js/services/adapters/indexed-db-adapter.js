import { createStore } from '../../lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from '../../lib/tinybase-persister-indexed-db.js';

export class IndexedDbAdapter {
  constructor() {
    this.store = createStore();
    this.store.setTable('docs', {});
    this.dbName = 'copio-blobs-db';
    this.storeName = 'blobs';
  }

  async #getDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => reject(request.error);
    });
  }


  async #sweepOrphans() {
    const validIds = new Set(Object.keys(this.store.getTable('docs')));
    try {
      const db = await this.#getDb();
      await new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAllKeys();
        request.onsuccess = () => {
          for (const key of request.result) {
            const docId = key.split('_')[0];
            if (!validIds.has(docId)) {
              console.log(`[IndexedDB] Sweeping orphaned page blob: ${key}`);
              store.delete(key);
            }
          }
          resolve();
        };
        request.onerror = () => resolve();
      });
    } catch (e) {
      // ignore
    }
  }

  async init() {
    this.persister = createIndexedDbPersister(this.store, 'copio-db');
    await this.persister.startAutoLoad();
    await this.persister.startAutoSave();
    await this.#sweepOrphans();
    
    let persistent = false;
    if (navigator.storage && navigator.storage.persisted) {
      persistent = await navigator.storage.persisted();
    }
    return { kind: 'indexeddb', persistent };
  }

  listDocs() {
    return this.store.getTable('docs');
  }

  getDoc(id) {
    const vals = this.store.getRow('docs', id);
    if (!vals || Object.keys(vals).length === 0) return null;
    return {
      id,
      name: vals.name,
      pages: JSON.parse(vals.pages || '[]')
    };
  }

  saveDoc(doc) {
    this.store.setRow('docs', doc.id, {
      name: doc.name,
      pages: JSON.stringify(doc.pages || [])
    });
  }

  async deleteDoc(id) {
    const doc = this.getDoc(id);
    this.store.delRow('docs', id);
    if (doc) {
      for (const page of doc.pages) {
        await this.deletePage(id, page.id);
      }
    }
  }

  #getKey(docId, pageId) {
    return `${docId}_${pageId}`;
  }

  async savePage(docId, pageId, blob) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(blob, this.#getKey(docId, pageId));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPage(docId, pageId) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this.#getKey(docId, pageId));
      request.onsuccess = (e) => resolve(e.target.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePage(docId, pageId) {
    const db = await this.#getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(this.#getKey(docId, pageId));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  subscribe(callback) {
    const listenerId = this.store.addTableListener('docs', callback);
    return () => this.store.delListener(listenerId);
  }

  getRawStore() {
    return this.store;
  }
}
