import { expect } from '@esm-bundle/chai';
import { CopioEngine, MemoryStorageAdapter } from '../sdk/index.js';

describe('CPO-028: Action guards and document operations on CopioEngine', () => {
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

  describe('Action guards on empty documents', () => {
    it('handles empty document queries cleanly without throwing', async () => {
      const doc = await engine.createDocument('Empty Doc', []);
      expect(doc.pages).to.have.lengthOf(0);

      const retrieved = await engine.getDocument(doc.id);
      expect(retrieved.pages).to.have.lengthOf(0);
    });

    it('rejects PDF export when document has zero pages', async () => {
      const doc = await engine.createDocument('Zero Page Doc', []);
      try {
        await engine.exportPdf(doc.id);
        expect.fail('Should have thrown on zero pages');
      } catch (err) {
        expect(err).to.exist;
      }
    });
  });

  describe('Document rename and metadata operations', () => {
    it('renames document cleanly in storage', async () => {
      const doc = await engine.createDocument('Initial Name', [
        { id: 'p1', src: 'data:image/png;base64,sample' },
      ]);
      expect(doc.name).to.equal('Initial Name');

      await engine.renameDocument(doc.id, 'Renamed Document');
      const fetched = await engine.getDocument(doc.id);
      expect(fetched.name).to.equal('Renamed Document');
    });
  });
});
