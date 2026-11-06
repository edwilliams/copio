import { expect } from '@esm-bundle/chai';
import { CopioEngine, MemoryStorageAdapter } from '../sdk/index.js';

describe('Document Flow: create, view, edit, and delete documents via CopioEngine', () => {
  let engine;

  beforeEach(async () => {
    engine = new CopioEngine({
      storage: new MemoryStorageAdapter(),
    });
    await engine.init();
  });

  afterEach(async () => {
    await engine.clear();
  });

  it('creates a document, retrieves it, and verifies page content', async () => {
    const docName = 'Invoice October 2026';
    const samplePage = {
      id: 'p1',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      name: 'Page 1',
      edits: { crop: null, rotate: 0, filter: 'none' },
    };

    const doc = await engine.createDocument(docName, [samplePage]);
    expect(doc).to.exist;
    expect(doc.id).to.be.a('string');
    expect(doc.name).to.equal(docName);
    expect(doc.pages).to.have.lengthOf(1);

    const retrieved = await engine.getDocument(doc.id);
    expect(retrieved).to.exist;
    expect(retrieved.name).to.equal(docName);
    expect(retrieved.pages[0].id).to.equal('p1');

    const docs = await engine.listDocuments();
    expect(docs.some((d) => d.id === doc.id)).to.be.true;
  });

  it('renames a document and updates storage', async () => {
    const doc = await engine.createDocument('Draft Document', [
      { id: 'p1', src: 'data:image/png;base64,sample' },
    ]);

    await engine.renameDocument(doc.id, 'Finalized Document');
    const updated = await engine.getDocument(doc.id);
    expect(updated.name).to.equal('Finalized Document');
  });

  it('adds pages and updates document in storage', async () => {
    const doc = await engine.createDocument('Multi-page Doc', [
      { id: 'p1', src: 'data:image/png;base64,sample1' },
    ]);

    await engine.addPages(doc.id, [
      { id: 'p2', src: 'data:image/png;base64,sample2' },
    ]);

    const updated = await engine.getDocument(doc.id);
    expect(updated.pages).to.have.lengthOf(2);
    expect(updated.pages[1].id).to.equal('p2');
  });

  it('deletes a document', async () => {
    const doc = await engine.createDocument('To Be Deleted', [
      { id: 'p1', src: 'data:image/png;base64,sample' },
    ]);

    await engine.deleteDocument(doc.id);
    const deleted = await engine.getDocument(doc.id);
    expect(deleted).to.be.null;

    const list = await engine.listDocuments();
    expect(list.some((d) => d.id === doc.id)).to.be.false;
  });
});
