import { StoragePort } from './storage-port.js';
import { MemoryStorageAdapter } from './memory-adapter.js';
import { IndexedDbStorageAdapter } from './indexeddb-adapter.js';

export { StoragePort, MemoryStorageAdapter, IndexedDbStorageAdapter };

/**
 * Creates the appropriate default storage adapter for the runtime environment.
 * Selects IndexedDB in browsers, falling back to MemoryStorageAdapter in
 * Node.js / SSR or when forceMemory is explicitly specified.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceMemory] - Force use of MemoryStorageAdapter
 * @param {string} [options.dbName] - Database name for IndexedDB
 * @param {any} [options.store] - Optional TinyBase store instance
 * @param {any} [options.persister] - Optional TinyBase persister instance
 * @returns {StoragePort}
 */
export function createDefaultAdapter(options = {}) {
  if (options.forceMemory) {
    return new MemoryStorageAdapter();
  }

  if (typeof indexedDB !== 'undefined') {
    return new IndexedDbStorageAdapter(options);
  }

  return new MemoryStorageAdapter();
}
