import { store, persister, dbReady } from '../../core/store.js';

export class TinyBaseAdapter {
  constructor() {
    this.store = store;
  }

  async init() {
    await dbReady;
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

  deleteDoc(id) {
    this.store.delRow('docs', id);
  }

  // Blob storage not implemented in the v1 schema
  async savePage(docId, pageId, blob) {
    throw new Error('savePage not implemented in TinyBaseAdapter');
  }

  async getPage(docId, pageId) {
    throw new Error('getPage not implemented in TinyBaseAdapter');
  }

  async deletePage(docId, pageId) {
    throw new Error('deletePage not implemented in TinyBaseAdapter');
  }

  subscribe(callback) {
    const listenerId = this.store.addTableListener('docs', callback);
    return () => this.store.delListener(listenerId);
  }

  getRawStore() {
    return this.store;
  }
}
