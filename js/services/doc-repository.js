import { store, persister } from '../core/store.js';
import { randomId } from '../utils/utils.js';

export class DocRepository {
  constructor() {
    this.store = store;
    this.persister = persister;
  }

  load() {
    return this.persister.load();
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

  saveDoc(id, name, pages) {
    this.store.setRow('docs', id, {
      name,
      pages: JSON.stringify(pages || [])
    });
  }

  createDoc(name, pages = []) {
    const id = randomId();
    this.saveDoc(id, name, pages);
    return id;
  }

  deleteDoc(id) {
    this.store.delRow('docs', id);
  }

  subscribe(callback) {
    return this.store.addTableListener('docs', callback);
  }
  
  unsubscribe(listenerId) {
    this.store.delListener(listenerId);
  }

  // To support sync-service
  getRawStore() {
    return this.store;
  }
}

export const docRepository = new DocRepository();
