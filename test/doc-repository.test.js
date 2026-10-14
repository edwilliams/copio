import { expect } from '@esm-bundle/chai';
import { DocRepository } from '../js/services/doc-repository.js';
import { MemoryStorageAdapter } from '../js/adapters/storage/memory-adapter.js';

describe('CPO-014: Headless DocRepository', () => {
  let repo;
  let adapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    repo = new DocRepository(adapter);
    await repo.init();
  });

  it('creates a new document with default title and empty pages', async () => {
    const doc = await repo.createDoc();
    expect(doc).to.exist;
    expect(doc.id).to.be.a('string');
    expect(doc.name).to.equal('Untitled Document');
    expect(doc.pages).to.deep.equal([]);

    const fetched = await repo.getDoc(doc.id);
    expect(fetched).to.deep.equal(doc);
  });

  it('creates document with custom title and initial pages', async () => {
    const pages = [
      { id: 'p1', src: 'data:image/png;base64,aaa', type: 'image' },
      { id: 'p2', type: 'markdown', name: 'Note 1', content: 'Notes' },
    ];
    const doc = await repo.createDoc('Tax Return 2026', pages);
    expect(doc.name).to.equal('Tax Return 2026');
    expect(doc.pages).to.have.lengthOf(2);

    const fetched = await repo.getDoc(doc.id);
    expect(fetched.pages).to.deep.equal(pages);
  });

  it('renames a document', async () => {
    const doc = await repo.createDoc('Initial Title');
    await repo.renameDoc(doc.id, 'Renamed Title');

    const updated = await repo.getDoc(doc.id);
    expect(updated.name).to.equal('Renamed Title');
  });

  it('deletes a document', async () => {
    const doc = await repo.createDoc('Temporary Doc');
    expect(await repo.getDoc(doc.id)).to.exist;

    await repo.deleteDoc(doc.id);
    expect(await repo.getDoc(doc.id)).to.be.null;

    const list = await repo.listDocs();
    expect(list.some((d) => d.id === doc.id)).to.be.false;
  });

  it('adds pages to an existing document', async () => {
    const doc = await repo.createDoc('Doc With Pages');
    await repo.addPages(doc.id, [
      { id: 'p1', src: 'img1', type: 'image' },
      { id: 'p2', src: 'img2', type: 'image' },
    ]);

    const updated = await repo.getDoc(doc.id);
    expect(updated.pages).to.have.lengthOf(2);
    expect(updated.pages.map((p) => p.id)).to.deep.equal(['p1', 'p2']);
  });

  it('updates an individual page in a document', async () => {
    const doc = await repo.createDoc('Update Page Doc', [
      { id: 'p1', src: 'img1', type: 'image' },
      { id: 'p2', type: 'markdown', name: 'Draft', content: 'hello' },
    ]);

    await repo.updatePage(doc.id, 'p2', { content: 'hello world', name: 'Final' });

    const updated = await repo.getDoc(doc.id);
    expect(updated.pages[1].content).to.equal('hello world');
    expect(updated.pages[1].name).to.equal('Final');
  });

  it('reorders pages according to an array of page IDs', async () => {
    const doc = await repo.createDoc('Reorder Doc', [
      { id: 'p1', src: 'img1' },
      { id: 'p2', src: 'img2' },
      { id: 'p3', src: 'img3' },
    ]);

    await repo.reorderPages(doc.id, ['p3', 'p1', 'p2']);

    const updated = await repo.getDoc(doc.id);
    expect(updated.pages.map((p) => p.id)).to.deep.equal(['p3', 'p1', 'p2']);
  });

  it('deletes an individual page from a document', async () => {
    const doc = await repo.createDoc('Delete Page Doc', [
      { id: 'p1', src: 'img1' },
      { id: 'p2', src: 'img2' },
      { id: 'p3', src: 'img3' },
    ]);

    await repo.deletePage(doc.id, 'p2');

    const updated = await repo.getDoc(doc.id);
    expect(updated.pages.map((p) => p.id)).to.deep.equal(['p1', 'p3']);
  });

  it('lists documents with pageCount metadata', async () => {
    await repo.createDoc('Doc 1', [{ id: 'p1' }, { id: 'p2' }]);
    await repo.createDoc('Doc 2', [{ id: 'p3' }]);

    const list = await repo.listDocs();
    expect(list).to.have.lengthOf(2);

    const doc1 = list.find((d) => d.name === 'Doc 1');
    expect(doc1.pageCount).to.equal(2);

    const doc2 = list.find((d) => d.name === 'Doc 2');
    expect(doc2.pageCount).to.equal(1);
  });

  it('notifies subscribers via subscribe callback', async () => {
    let callCount = 0;
    const unsub = repo.subscribe(() => {
      callCount++;
    });

    await repo.createDoc('Reactive Doc');
    expect(callCount).to.be.greaterThan(0);

    const prevCount = callCount;
    unsub();
    await repo.createDoc('Silent Doc');
    expect(callCount).to.equal(prevCount);
  });

  it('exports and imports documents for synchronization', async () => {
    await repo.createDoc('Doc A', [{ id: 'pa' }]);
    await repo.createDoc('Doc B', [{ id: 'pb' }]);

    const exported = await repo.exportAll();
    expect(Object.keys(exported)).to.have.lengthOf(2);

    const targetRepo = new DocRepository(new MemoryStorageAdapter());
    const added = await targetRepo.importDocs(exported);
    expect(added).to.equal(2);

    const targetDocs = await targetRepo.listDocs();
    expect(targetDocs).to.have.lengthOf(2);
    expect(targetDocs.map((d) => d.name).sort()).to.deep.equal(['Doc A', 'Doc B']);
  });
});
