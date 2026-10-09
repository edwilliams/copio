export class MemoryAdapter {
  constructor() {
    this.docs = new Map();
    this.pages = new Map(); // key: docId_pageId
    this.listeners = new Set();
  }

  async init() {
    return { kind: 'memory', persistent: false };
  }

  listDocs() {
    return Object.fromEntries(this.docs.entries());
  }

  getDoc(id) {
    return this.docs.get(id) || null;
  }

  saveDoc(doc) {
    this.docs.set(doc.id, { id: doc.id, name: doc.name, pages: doc.pages || [] });
    this.#notify();
  }

  deleteDoc(id) {
    this.docs.delete(id);
    for (const key of this.pages.keys()) {
      if (key.startsWith(`${id}_`)) {
        this.pages.delete(key);
      }
    }
    this.#notify();
  }

  savePage(docId, pageId, blob) {
    this.pages.set(`${docId}_${pageId}`, blob);
  }

  getPage(docId, pageId) {
    return this.pages.get(`${docId}_${pageId}`) || null;
  }

  deletePage(docId, pageId) {
    this.pages.delete(`${docId}_${pageId}`);
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  #notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }
}
