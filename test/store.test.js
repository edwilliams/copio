import { expect } from '@esm-bundle/chai';
import { IndexedDbStorageAdapter } from '../js/adapters/storage/indexeddb-adapter.js';

describe('IndexedDbStorageAdapter TinyBase Store', () => {
  it('should initialize with docs table', () => {
    const adapter = new IndexedDbStorageAdapter({ dbName: 'test-store-db' });
    expect(adapter.store).to.exist;
    const docs = adapter.store.getTable('docs');
    expect(docs).to.be.an('object');
  });

  it('should allow setting, reading and deleting doc rows in TinyBase', () => {
    const adapter = new IndexedDbStorageAdapter({ dbName: 'test-store-db' });
    const testDocId = 'test-doc-123';
    adapter.store.setRow('docs', testDocId, {
      name: 'Sample Test Doc',
      pages: JSON.stringify([{ id: 'p1', src: 'data:image/png;base64,sample' }]),
    });

    const row = adapter.store.getRow('docs', testDocId);
    expect(row).to.exist;
    expect(row.name).to.equal('Sample Test Doc');

    // Clean up
    adapter.store.delRow('docs', testDocId);
    expect(adapter.store.hasRow('docs', testDocId)).to.be.false;
  });
});
