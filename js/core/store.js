import { createStore } from '../lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from '../lib/tinybase-persister-indexed-db.js';
import { runMigrations } from './migrations.js';

export const store = createStore();
store.setTable('docs', {});

export const persister = createIndexedDbPersister(store, 'copio-db');

export const dbReady = (async () => {
  await persister.startAutoLoad();
  await runMigrations(store);
  await persister.startAutoSave();
})();
