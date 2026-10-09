import { expect } from '@esm-bundle/chai';
import { DocRepository } from '../js/services/doc-repository.js';
import { TinyBaseAdapter } from '../js/services/adapters/tinybase-adapter.js';
import { MemoryAdapter } from '../js/services/adapters/memory-adapter.js';

const adapters = [
  { name: 'TinyBaseAdapter', create: () => new TinyBaseAdapter() },
  { name: 'MemoryAdapter', create: () => new MemoryAdapter() }
];

for (const { name, create } of adapters) {
  describe(`doc-repository.js with ${name}`, () => {
    let repo;

    beforeEach(async () => {
      repo = new DocRepository(create());
      await repo.init();
      if (repo.getRawStore()) {
        repo.getRawStore().delTable('docs');
      }
    });

    it('createDoc should create a new document with given name and empty pages', () => {
      const docId = repo.createDoc('My Doc');
      const doc = repo.getDoc(docId);
      
      expect(doc).to.exist;
      expect(doc.id).to.equal(docId);
      expect(doc.name).to.equal('My Doc');
      expect(doc.pages).to.deep.equal([]);
    });

    it('saveDoc should update document name and pages', () => {
      const docId = repo.createDoc('Initial');
      
      const pages = [{ id: 'p1', src: 'data:image/png;base64,A==' }];
      repo.saveDoc(docId, 'Updated', pages);
      
      const doc = repo.getDoc(docId);
      expect(doc.name).to.equal('Updated');
      expect(doc.pages).to.deep.equal(pages);
    });

    it('deleteDoc should remove the document', () => {
      const docId = repo.createDoc('To Delete');
      expect(repo.getDoc(docId)).to.exist;
      
      repo.deleteDoc(docId);
      expect(repo.getDoc(docId)).to.be.null;
    });

    it('listDocs should return all documents', () => {
      repo.createDoc('Doc 1');
      repo.createDoc('Doc 2');
      
      const docs = repo.listDocs();
      expect(Object.keys(docs).length).to.equal(2);
    });
  });
}
