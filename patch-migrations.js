import fs from 'fs';

const content = `import { createStore } from '../lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from '../lib/tinybase-persister-indexed-db.js';

export const CURRENT_SCHEMA_VERSION = 2;

async function base64ToBlob(base64) {
  const res = await fetch(base64);
  return await res.blob();
}

async function migrateV1ToV2(adapter, oldStore) {
  // Extract base64 to blobs
  const docs = oldStore.getTable('docs');
  for (const docId of Object.keys(docs)) {
    const docRow = docs[docId];
    const pages = JSON.parse(docRow.pages || '[]');
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.src && p.src.startsWith('data:')) {
        const blob = await base64ToBlob(p.src);
        await adapter.savePage(docId, p.id, blob);
        // Remove src from metadata
        delete p.src;
      }
    }
    // Save updated doc back
    adapter.saveDoc({ id: docId, name: docRow.name, pages });
  }
}

export async function runMigrations(adapter) {
  const store = adapter.getRawStore();
  let currentVersion = store.getValue('schemaVersion') || 0;

  if (currentVersion === 0 && Object.keys(store.getTable('docs')).length === 0) {
    // Check if legacy IDB exists
    const tempStore = createStore();
    const tempPersister = createIndexedDbPersister(tempStore, 'copio-db');
    await tempPersister.startAutoLoad();
    
    if (Object.keys(tempStore.getTable('docs')).length > 0) {
      // Legacy data found!
      console.log('Legacy v1 data found in IDB. Migrating...');
      await migrateV1ToV2(adapter, tempStore);
      store.setValue('schemaVersion', 2);
      
      // We don't delete the old IDB yet, as a safety measure.
      // The old IDB will just sit there and not be updated.
      return;
    } else {
      // Truly a fresh install
      store.setValue('schemaVersion', CURRENT_SCHEMA_VERSION);
      return;
    }
  }

  // If there's data but no version (or version 1), and it's already in the adapter (e.g. IDB adapter fallback)
  if (currentVersion < 2 && Object.keys(store.getTable('docs')).length > 0) {
    console.log('Migrating existing adapter data to v2...');
    await migrateV1ToV2(adapter, store);
    store.setValue('schemaVersion', 2);
    currentVersion = 2;
  }
}
`;

fs.writeFileSync('js/core/migrations.js', content);
