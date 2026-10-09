import { expect } from '@esm-bundle/chai';
import { IndexedDbAdapter } from '../js/services/adapters/indexed-db-adapter.js';
import { runMigrations, CURRENT_SCHEMA_VERSION } from '../js/core/migrations.js';

describe('migrations.js', () => {
  let adapter;

  beforeEach(async () => {
    adapter = new IndexedDbAdapter();
    await adapter.init();
    const store = adapter.getRawStore();
    store.delTable('docs');
    store.delValue('schemaVersion');
  });

  it('should initialize schemaVersion on fresh install', async () => {
    await runMigrations(adapter);
    expect(adapter.getRawStore().getValue('schemaVersion')).to.equal(CURRENT_SCHEMA_VERSION);
  });

  it('should run migrations incrementally', async () => {
    const store = adapter.getRawStore();
    store.setTable('docs', {
      'doc1': { name: 'Old Doc', pages: '[]' }
    });
    store.setValue('schemaVersion', 0); // Pretend it is an old version with data
    
    await runMigrations(adapter);
    
    expect(store.getValue('schemaVersion')).to.equal(CURRENT_SCHEMA_VERSION);
  });
});
