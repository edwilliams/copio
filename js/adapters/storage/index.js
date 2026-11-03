import { StoragePort } from './storage-port.js';
import { MemoryStorageAdapter } from './memory-adapter.js';
import { IndexedDbStorageAdapter } from './indexeddb-adapter.js';
import { OpfsStorageAdapter, probeOpfs } from './opfs-adapter.js';

export {
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  OpfsStorageAdapter,
  probeOpfs,
};

/**
 * Creates the appropriate default storage adapter for the runtime environment (CPO-012).
 * Selects OPFS in browsers when available, falling back to IndexedDbStorageAdapter,
 * or MemoryStorageAdapter in Node.js / SSR or when forceMemory is explicitly specified.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceMemory] - Force use of MemoryStorageAdapter
 * @param {boolean} [options.forceIndexedDb] - Force use of IndexedDbStorageAdapter
 * @param {boolean} [options.forceOpfs] - Force use of OpfsStorageAdapter
 * @param {string} [options.dbName] - Database name for IndexedDB
 * @param {string} [options.dirName] - Directory name for OPFS
 * @param {any} [options.store] - Optional TinyBase store instance
 * @param {any} [options.persister] - Optional TinyBase persister instance
 * @returns {StoragePort}
 */
export function createDefaultAdapter(options = {}) {
  if (options.forceMemory) {
    return new MemoryStorageAdapter();
  }

  if (options.forceIndexedDb) {
    return new IndexedDbStorageAdapter(options);
  }

  if (options.forceOpfs) {
    return new OpfsStorageAdapter(options);
  }

  // If in browser environment with OPFS support
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'
  ) {
    return new OpfsStorageAdapter(options);
  }

  if (typeof indexedDB !== 'undefined') {
    return new IndexedDbStorageAdapter(options);
  }

  return new MemoryStorageAdapter();
}
