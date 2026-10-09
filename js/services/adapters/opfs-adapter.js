import { createStore } from '../../lib/tinybase.6.5.2.js';
import { createOpfsPersister } from '../../lib/tinybase-persister-opfs.js';

export class OpfsAdapter {
  constructor() {
    this.store = createStore();
    this.store.setTable('docs', {});
  }

  static async isSupported() {
    try {
      const dir = await navigator.storage.getDirectory();
      const testHandle = await dir.getFileHandle('_opfs_test', { create: true });
      await testHandle.remove();
      return true;
    } catch (e) {
      return false;
    }
  }


  async #sweepOrphans() {
    try {
      const root = await navigator.storage.getDirectory();
      const copioDir = await root.getDirectoryHandle('copio');
      const docsDir = await copioDir.getDirectoryHandle('docs');
      
      const validIds = new Set(Object.keys(this.store.getTable('docs')));
      
      for await (const [name, handle] of docsDir.entries()) {
        if (handle.kind === 'directory' && !validIds.has(name)) {
          console.log(`[OPFS] Sweeping orphaned directory: ${name}`);
          await docsDir.removeEntry(name, { recursive: true });
        }
      }
    } catch (e) {
      // Ignore if directories don't exist yet
    }
  }

  async init() {
    this.persister = createOpfsPersister(this.store, 'copio/store.json');
    await this.persister.startAutoLoad();
    await this.persister.startAutoSave();
    await this.#sweepOrphans();
    
    let persistent = false;
    if (navigator.storage && navigator.storage.persisted) {
      persistent = await navigator.storage.persisted();
    }
    
    return { kind: 'opfs', persistent };
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
    // Also need to delete the OPFS directory for this doc
    this.#deleteDocDir(id).catch(console.error);
  }

  async #getDocDir(docId, create = false) {
    const root = await navigator.storage.getDirectory();
    const copioDir = await root.getDirectoryHandle('copio', { create });
    const docsDir = await copioDir.getDirectoryHandle('docs', { create });
    return await docsDir.getDirectoryHandle(docId, { create });
  }

  async #deleteDocDir(docId) {
    try {
      const root = await navigator.storage.getDirectory();
      const copioDir = await root.getDirectoryHandle('copio');
      const docsDir = await copioDir.getDirectoryHandle('docs');
      await docsDir.removeEntry(docId, { recursive: true });
    } catch (e) {
      // Ignore if directory doesn't exist
    }
  }

  async savePage(docId, pageId, blob) {
    const docDir = await this.#getDocDir(docId, true);
    // Extension doesn't matter much for blob reading, but we can store it without ext for simplicity
    const fileHandle = await docDir.getFileHandle(pageId, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async getPage(docId, pageId) {
    try {
      const docDir = await this.#getDocDir(docId, false);
      const fileHandle = await docDir.getFileHandle(pageId);
      return await fileHandle.getFile();
    } catch (e) {
      return null;
    }
  }

  async deletePage(docId, pageId) {
    try {
      const docDir = await this.#getDocDir(docId, false);
      await docDir.removeEntry(pageId);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  }

  subscribe(callback) {
    const listenerId = this.store.addTableListener('docs', callback);
    return () => this.store.delListener(listenerId);
  }

  getRawStore() {
    return this.store;
  }
}
