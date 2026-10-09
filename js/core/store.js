import { createStore } from '../lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from '../lib/tinybase-persister-indexed-db.js';

export const store = createStore();
store.setTable('docs', {});

export const persister = createIndexedDbPersister(store, 'copio-db');
persister.startAutoLoad();
persister.startAutoSave();
