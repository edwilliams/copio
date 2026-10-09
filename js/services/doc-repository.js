import { randomId } from '../utils/utils.js';
import { OpfsAdapter } from './adapters/opfs-adapter.js';
import { IndexedDbAdapter } from './adapters/indexed-db-adapter.js';
import { runMigrations } from '../core/migrations.js';

export class DocRepository {
  constructor(adapter = null) {
    this.adapter = adapter;
    this.listeners = new Set();
  }

  async init() {
    if (!this.adapter) {
      if (await OpfsAdapter.isSupported()) {
        this.adapter = new OpfsAdapter();
      } else {
        this.adapter = new IndexedDbAdapter();
      }
    }
    const result = await this.adapter.init();
    this.adapter.persistent = result.persistent;
    await runMigrations(this);
    this.adapter.subscribe(() => {
      for (const cb of this.listeners) cb();
    });
    // Trigger listeners initially so UI gets the loaded data
    for (const cb of this.listeners) cb();
    return result;
  }

  listDocs() {
    return this.adapter?.listDocs() || {};
  }

  getDoc(id) {
    return this.adapter?.getDoc(id) || null;
  }

  saveDoc(id, name, pages) {
    this.adapter?.saveDoc({ id, name, pages });
  }

  createDoc(name, pages = []) {
    const id = randomId();
    this.saveDoc(id, name, pages);
    return id;
  }

  deleteDoc(id) {
    this.adapter?.deleteDoc(id);
  }

  async getPage(docId, pageId) {
    return this.adapter?.getPage(docId, pageId);
  }

  async savePage(docId, pageId, blob) {
    return this.adapter?.savePage(docId, pageId, blob);
  }

  async deletePage(docId, pageId) {
    return this.adapter?.deletePage(docId, pageId);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  unsubscribe(unsubscribeFn) {
    if (typeof unsubscribeFn === 'function') {
      unsubscribeFn();
    }
  }

  getRawStore() {
    if (this.adapter?.getRawStore) {
      return this.adapter.getRawStore();
    }
    return null;
  }
}

export const docRepository = new DocRepository();
