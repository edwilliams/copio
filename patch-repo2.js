import fs from 'fs';

const content = `import { randomId } from '../utils/utils.js';
import { OpfsAdapter } from './adapters/opfs-adapter.js';
import { IndexedDbAdapter } from './adapters/indexed-db-adapter.js';

export class DocRepository {
  constructor(adapter = null) {
    this.adapter = adapter;
  }

  async init() {
    if (!this.adapter) {
      if (await OpfsAdapter.isSupported()) {
        this.adapter = new OpfsAdapter();
      } else {
        this.adapter = new IndexedDbAdapter();
      }
    }
    return this.adapter.init();
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
    return this.adapter?.subscribe(callback);
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
`;

fs.writeFileSync('js/services/doc-repository.js', content);
