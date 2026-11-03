import { expect } from '@esm-bundle/chai';
import { MemoryStorageAdapter } from '../js/adapters/storage/memory-adapter.js';
import { IndexedDbStorageAdapter } from '../js/adapters/storage/indexeddb-adapter.js';
import { OpfsStorageAdapter, probeOpfs } from '../js/adapters/storage/opfs-adapter.js';
import { createDefaultAdapter } from '../js/adapters/storage/index.js';

describe('CPO-033 / CPO-012: StoragePort Adapters Compliance', () => {
  const adapterFactories = [
    {
      name: 'MemoryStorageAdapter',
      create: () => new MemoryStorageAdapter(),
    },
    {
      name: 'IndexedDbStorageAdapter (Custom DB)',
      create: () => new IndexedDbStorageAdapter({ dbName: 'test-db-' + Date.now() }),
    },
    {
      name: 'OpfsStorageAdapter (Custom Dir)',
      create: () => new OpfsStorageAdapter({ dirName: 'test-copio-' + Date.now() }),
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
    it('creates OpfsStorageAdapter by default in browser with OPFS support', () => {
      const adapter = createDefaultAdapter();
      expect(adapter).to.be.an.instanceOf(OpfsStorageAdapter);
    });

    it('creates IndexedDbStorageAdapter when forceIndexedDb is true', () => {
      const adapter = createDefaultAdapter({ forceIndexedDb: true });
      expect(adapter).to.be.an.instanceOf(IndexedDbStorageAdapter);
    });

    it('forces MemoryStorageAdapter when forceMemory is true', () => {
      const adapter = createDefaultAdapter({ forceMemory: true });
      expect(adapter).to.be.an.instanceOf(MemoryStorageAdapter);
    });
  });

  describe('CPO-012: OPFS Storage & Probing', () => {
    it('probeOpfs returns boolean indicating availability', async () => {
      const isAvailable = await probeOpfs();
      expect(isAvailable).to.be.a('boolean');
    });

    it('cleans up orphaned files during startup sweep in OPFS', async () => {
      const dirName = 'test-sweep-opfs-' + Date.now();
      const adapter = new OpfsStorageAdapter({ dirName });
      const initInfo = await adapter.init();

      if (initInfo.kind === 'opfs') {
        const docId = 'doc-sweep-test';
        await adapter.saveDoc(docId, {
          id: docId,
          name: 'Doc Sweep Test',
          pages: [
            { id: 'page-keep', src: 'data:image/png;base64,123' },
          ],
        });

        // Add a rogue file directly to the doc directory that is NOT in metadata
        const root = await navigator.storage.getDirectory();
        const copioDir = await root.getDirectoryHandle(dirName);
        const docsDir = await copioDir.getDirectoryHandle('docs');
        const docDir = await docsDir.getDirectoryHandle(docId);
        const orphanFile = await docDir.getFileHandle('page-orphan.bin', { create: true });
        const w = await orphanFile.createWritable();
        await w.write('rogue');
        await w.close();

        // Also add an orphaned doc directory
        await docsDir.getDirectoryHandle('orphan-doc-dir', { create: true });

        // Run sweep
        const removed = await adapter.sweepOrphans();
        expect(removed).to.be.at.least(2);

        // Verify orphan file is gone
        let orphanFound = false;
        try {
          await docDir.getFileHandle('page-orphan.bin');
          orphanFound = true;
        } catch {}
        expect(orphanFound).to.be.false;

        // Verify valid file remains
        const keepFile = await docDir.getFileHandle('page-keep.bin');
        expect(keepFile).to.exist;
      }
    });

    it('falls back to IndexedDB if forceFallback is enabled', async () => {
      const adapter = new OpfsStorageAdapter({ forceFallback: true, dbName: 'test-fallback-' + Date.now() });
      const info = await adapter.init();
      expect(info.kind).to.equal('indexeddb');
      expect(adapter.isFallback).to.be.true;

      await adapter.saveDoc('doc-fb-1', { id: 'doc-fb-1', name: 'Fallback Doc', pages: [] });
      const doc = await adapter.getDoc('doc-fb-1');
      expect(doc.name).to.equal('Fallback Doc');
    });
  });

  describe('CPO-012: Stored Size Reduction Benchmark (20-page document)', () => {
    it('reduces metadata storage size by >90% compared to Base64 in TinyBase row', async () => {
      // 1. Simulate 20 pages with sample JPEG image data URLs (approx 50 KB each)
      const sampleBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(50000);
      const pages = [];
      for (let i = 1; i <= 20; i++) {
        pages.push({
          id: `page-${i}`,
          name: `Page ${i}`,
          src: sampleBase64,
          type: 'image',
        });
      }

      // Legacy approach: 20 pages storing Base64 directly in TinyBase JSON row
      const legacyJson = JSON.stringify(pages);
      const legacySizeBytes = new Blob([legacyJson]).size;

      // CPO-012 approach: save via OpfsStorageAdapter / IndexedDbStorageAdapter
      const adapter = new OpfsStorageAdapter({ dirName: 'test-size-' + Date.now() });
      await adapter.init();

      await adapter.saveDoc('doc-20-pages', {
        id: 'doc-20-pages',
        name: '20 Page Test Document',
        pages,
      });

      // Check TinyBase metadata row size
      const row = adapter.store.getRow('docs', 'doc-20-pages');
      const optimizedMetadataBytes = new Blob([row.pages]).size;

      // Log before & after measurement
      console.log(`[CPO-012 Benchmark] 20-page document metadata size:`);
      console.log(`  - Before (Base64 in TinyBase): ${(legacySizeBytes / 1024).toFixed(2)} KB`);
      console.log(`  - After (Blob/OPFS storage): ${(optimizedMetadataBytes / 1024).toFixed(2)} KB`);
      console.log(`  - Reduction: ${(((legacySizeBytes - optimizedMetadataBytes) / legacySizeBytes) * 100).toFixed(1)}%`);

      // Verify >90% reduction in metadata row size
      expect(legacySizeBytes).to.be.greaterThan(900 * 1024); // ~1 MB
      expect(optimizedMetadataBytes).to.be.lessThan(10 * 1024); // < 10 KB
      expect(optimizedMetadataBytes / legacySizeBytes).to.be.lessThan(0.05); // >95% reduction

      // Verify pages are fully retrievable
      const fetched = await adapter.getDoc('doc-20-pages');
      expect(fetched.pages).to.have.lengthOf(20);
      expect(fetched.pages[0].src).to.exist;
      expect(fetched.pages[0].blob).to.exist;
    });
  });
});
