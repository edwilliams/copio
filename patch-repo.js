import fs from 'fs';

let content = fs.readFileSync('js/services/doc-repository.js', 'utf8');

const newMethods = `
  async getPage(docId, pageId) {
    return this.adapter.getPage(docId, pageId);
  }

  async savePage(docId, pageId, blob) {
    return this.adapter.savePage(docId, pageId, blob);
  }

  async deletePage(docId, pageId) {
    return this.adapter.deletePage(docId, pageId);
  }

  subscribe(callback) {`;

content = content.replace("  subscribe(callback) {", newMethods);

const factory = `
import { OpfsAdapter } from './adapters/opfs-adapter.js';
import { IndexedDbAdapter } from './adapters/indexed-db-adapter.js';

async function createDefaultAdapter() {
  if (await OpfsAdapter.isSupported()) {
    console.log('Storage: OPFS Adapter');
    return new OpfsAdapter();
  }
  console.log('Storage: IndexedDB Adapter');
  return new IndexedDbAdapter();
}

// Note: we can't export a synchronously fully-initialized repo if createDefaultAdapter is async.
// We should probably just initialize it in init().
`;

fs.writeFileSync('js/services/doc-repository.js', content);
