import { expect } from '@esm-bundle/chai';
import { docRepository } from '../js/services/doc-repository.js';

describe('doc-repository.js', () => {
  beforeEach(async () => {
    // Clear out the docs table before each test
    docRepository.store.delTable('docs');
  });

  it('createDoc should create a new document with given name and empty pages', () => {
    const docId = docRepository.createDoc('My Doc');
    const doc = docRepository.getDoc(docId);
    
    expect(doc).to.exist;
    expect(doc.id).to.equal(docId);
    expect(doc.name).to.equal('My Doc');
    expect(doc.pages).to.deep.equal([]);
  });

  it('saveDoc should update document name and pages', () => {
    const docId = docRepository.createDoc('Initial');
    
    const pages = [{ id: 'p1', src: 'data:image/png;base64,A==' }];
    docRepository.saveDoc(docId, 'Updated', pages);
    
    const doc = docRepository.getDoc(docId);
    expect(doc.name).to.equal('Updated');
    expect(doc.pages).to.deep.equal(pages);
  });

  it('deleteDoc should remove the document', () => {
    const docId = docRepository.createDoc('To Delete');
    expect(docRepository.getDoc(docId)).to.exist;
    
    docRepository.deleteDoc(docId);
    expect(docRepository.getDoc(docId)).to.be.null;
  });

  it('listDocs should return all documents', () => {
    docRepository.createDoc('Doc 1');
    docRepository.createDoc('Doc 2');
    
    const docs = docRepository.listDocs();
    expect(Object.keys(docs).length).to.equal(2);
  });
});
