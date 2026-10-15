/**
 * Copio Headless Core Domain & Storage (CPO-045, CPO-061)
 * Hexagonal Core: Pure JS domain use cases, models, and driven ports.
 * Zero DOM, zero Lit, zero browser UI globals.
 */
import { DocRepository, docRepository } from '../js/services/doc-repository.js';
import {
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  createDefaultAdapter,
} from '../js/adapters/storage/index.js';
import {
  randomId,
  fileToBase64,
  thresholdSrc,
  rotateSrc,
  getCroppedSrc,
  extractExif,
} from '../js/utils/utils.js';
import { BUILD_DATE, VERSION } from './version.js';

export class CopioEngine {
  /**
   * @param {Object} [options]
   * @param {StoragePort} [options.storage]
   * @param {DocRepository} [options.repository]
   */
  constructor(options = {}) {
    this.storage = options.storage || createDefaultAdapter(options);
    this.repository = options.repository || new DocRepository(this.storage);
  }

  async init() {
    return this.storage.init();
  }

  get docs() {
    return this.repository;
  }

  async listDocuments() {
    return this.repository.listDocs();
  }

  async getDocument(id) {
    return this.repository.getDoc(id);
  }

  async createDocument(name, pages) {
    return this.repository.createDoc(name, pages);
  }

  async deleteDocument(id) {
    return this.repository.deleteDoc(id);
  }

  async renameDocument(id, name) {
    return this.repository.renameDoc(id, name);
  }

  async addPages(id, pages) {
    return this.repository.addPages(id, pages);
  }

  async deletePage(id, pageId) {
    return this.repository.deletePage(id, pageId);
  }

  async updatePage(id, pageId, updates) {
    return this.repository.updatePage(id, pageId, updates);
  }

  async reorderPages(id, pageIds) {
    return this.repository.reorderPages(id, pageIds);
  }

  subscribe(callback) {
    return this.repository.subscribe(callback);
  }
}

export {
  DocRepository,
  docRepository,
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  createDefaultAdapter,
  randomId,
  fileToBase64,
  thresholdSrc,
  rotateSrc,
  getCroppedSrc,
  extractExif,
  BUILD_DATE,
  VERSION,
};
