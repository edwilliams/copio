import type { Store } from './tinybase.6.5.2.js';

export interface Persister {
  load(): Promise<Persister>;
  save(): Promise<Persister>;
  startAutoLoad(): Promise<Persister>;
  startAutoSave(): Promise<Persister>;
  destroy(): void;
}
export function createIndexedDbPersister(store: Store, dbName: string): Persister;
