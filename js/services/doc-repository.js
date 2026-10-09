import { randomId } from '../utils/utils.js';
import { TinyBaseAdapter } from './adapters/tinybase-adapter.js';

export class DocRepository {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async init() {
    return this.adapter.init();
  }

  listDocs() {
    return this.adapter.listDocs();
  }

  getDoc(id) {
    return this.adapter.getDoc(id);
  }

  saveDoc(id, name, pages) {
    this.adapter.saveDoc({ id, name, pages });
  }

  createDoc(name, pages = []) {
    const id = randomId();
    this.saveDoc(id, name, pages);
    return id;
  }

  deleteDoc(id) {
    this.adapter.deleteDoc(id);
  }

  subscribe(callback) {
    return this.adapter.subscribe(callback);
  }
  
  unsubscribe(unsubscribeFn) {
    if (typeof unsubscribeFn === 'function') {
      unsubscribeFn();
    }
  }

  // To support sync-service
  getRawStore() {
    if (this.adapter.getRawStore) {
      return this.adapter.getRawStore();
    }
    return null;
  }
}

// Temporary: hardcode the default adapter until CPO-012 builds the factory
export const docRepository = new DocRepository(new TinyBaseAdapter());
