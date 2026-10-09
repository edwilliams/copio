import { expect } from '@esm-bundle/chai';
import { createStore } from '../js/lib/tinybase.6.5.2.js';
import { runMigrations, CURRENT_SCHEMA_VERSION } from '../js/core/migrations.js';

describe('migrations.js', () => {
  it('should initialize schemaVersion on fresh install', async () => {
    const store = createStore();
    store.setTable('docs', {});
    
    await runMigrations(store);
    
    expect(store.getValue('schemaVersion')).to.equal(CURRENT_SCHEMA_VERSION);
  });

  it('should run migrations incrementally', async () => {
    const store = createStore();
    store.setTable('docs', {
      'doc1': { name: 'Old Doc', pages: '[]' }
    });
    store.setValue('schemaVersion', 0); // Pretend it is an old version with data
    
    // We don't have migrations yet, but it should end up at CURRENT_SCHEMA_VERSION
    await runMigrations(store);
    
    expect(store.getValue('schemaVersion')).to.equal(CURRENT_SCHEMA_VERSION);
  });
});
