import { expect } from '@esm-bundle/chai';
import { MemoryStorageAdapter } from '../js/adapters/storage/memory-adapter.js';
import { IndexedDbStorageAdapter } from '../js/adapters/storage/indexeddb-adapter.js';
import { createDefaultAdapter } from '../js/adapters/storage/index.js';

describe('CPO-033: StoragePort Adapters Compliance', () => {
  const adapterFactories = [
    {
      name: 'MemoryStorageAdapter',
      create: () => new MemoryStorageAdapter(),
    },
    {
      name: 'IndexedDbStorageAdapter (Custom DB)',
      create: () => new IndexedDbStorageAdapter({ dbName: 'test-db-' + Date.now() }),
    },
  ];

  adapterFactories.forEach(({ name, create }) => {
    describe(`${name}`, () => {
      let adapter;

      beforeEach(async () => {
        adapter = create();
        await adapter.init();
      });

      it('initializes and reports adapter kind and persistence', async () => {
        const info = await adapter.init();
        expect(info).to.be.an('object');
        expect(info.kind).to.be.a('string');
        expect(info.persistent).to.be.a('boolean');
      });

      it('saves, retrieves, and lists documents', async () => {
        const docId = 'doc-test-1';
        const doc = {
          id: docId,
          name: 'Passport Scan',
          pages: [
            { id: 'page-1', src: 'data:image/png;base64,123', type: 'image' },
            { id: 'page-2', src: 'data:image/png;base64,456', type: 'image' },
          ],
        };

        await adapter.saveDoc(docId, doc);

        const fetched = await adapter.getDoc(docId);
        expect(fetched).to.exist;
        expect(fetched.id).to.equal(docId);
        expect(fetched.name).to.equal('Passport Scan');
        expect(fetched.pages).to.have.lengthOf(2);
        expect(fetched.pages[0].id).to.equal('page-1');

        const docs = await adapter.listDocs();
        const found = docs.find((d) => d.id === docId);
        expect(found).to.exist;
        expect(found.name).to.equal('Passport Scan');
        expect(found.pages).to.have.lengthOf(2);
      });

      it('returns null for non-existent documents', async () => {
        const fetched = await adapter.getDoc('non-existent-id');
        expect(fetched).to.be.null;
      });

      it('updates existing document', async () => {
        const docId = 'doc-update-test';
        await adapter.saveDoc(docId, { id: docId, name: 'Old Name', pages: [] });

        await adapter.saveDoc(docId, { id: docId, name: 'Updated Name', pages: [{ id: 'p1', src: 'x' }] });

        const updated = await adapter.getDoc(docId);
        expect(updated.name).to.equal('Updated Name');
        expect(updated.pages).to.have.lengthOf(1);
      });

      it('deletes document and clears its entry', async () => {
        const docId = 'doc-delete-test';
        await adapter.saveDoc(docId, { id: docId, name: 'To Delete', pages: [] });
        expect(await adapter.getDoc(docId)).to.exist;

        await adapter.deleteDoc(docId);
        expect(await adapter.getDoc(docId)).to.be.null;

        const docs = await adapter.listDocs();
        expect(docs.some((d) => d.id === docId)).to.be.false;
      });

      it('saves, retrieves, and deletes individual pages', async () => {
        const docId = 'doc-pages-test';
        await adapter.saveDoc(docId, { id: docId, name: 'Page Test Doc', pages: [] });

        await adapter.savePage(docId, 'page-a', { id: 'page-a', src: 'data:image/png;base64,aaa' });
        await adapter.savePage(docId, 'page-b', { id: 'page-b', src: 'data:image/png;base64,bbb' });

        const pageA = await adapter.getPage(docId, 'page-a');
        expect(pageA).to.exist;

        const doc = await adapter.getDoc(docId);
        expect(doc.pages).to.have.lengthOf(2);

        await adapter.deletePage(docId, 'page-a');
        const docAfterDelete = await adapter.getDoc(docId);
        expect(docAfterDelete.pages).to.have.lengthOf(1);
        expect(docAfterDelete.pages[0].id).to.equal('page-b');
      });

      it('notifies subscribers on document changes', async () => {
        let notified = 0;
        const unsubscribe = adapter.subscribe(() => {
          notified++;
        });

        await adapter.saveDoc('doc-notify', { id: 'doc-notify', name: 'Notify', pages: [] });
        expect(notified).to.be.greaterThan(0);

        const currentCount = notified;
        unsubscribe();
        await adapter.saveDoc('doc-notify', { id: 'doc-notify', name: 'Notify Again', pages: [] });
        expect(notified).to.equal(currentCount);
      });
    });
  });

  describe('createDefaultAdapter factory', () => {
    it('creates IndexedDbStorageAdapter when IndexedDB is available', () => {
      const adapter = createDefaultAdapter();
      expect(adapter).to.be.an.instanceOf(IndexedDbStorageAdapter);
    });

    it('forces MemoryStorageAdapter when forceMemory is true', () => {
      const adapter = createDefaultAdapter({ forceMemory: true });
      expect(adapter).to.be.an.instanceOf(MemoryStorageAdapter);
    });
  });
});
