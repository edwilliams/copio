import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { store, persister } from '../js/core/store.js';
import { router } from '../js/core/router.js';
import { createStore } from '../js/lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from '../js/lib/tinybase-persister-indexed-db.js';

describe('Document Flow: create and view a document', () => {
  let app;

  beforeEach(async () => {
    // Start with a clean docs table and home route, persisted to IndexedDB
    store.delTable('docs');
    await persister.save();
    router.navigate('/');

    // Mount copio-app into the test page
    app = document.createElement('copio-app');
    document.body.appendChild(app);
    await app.updateComplete;
  });

  afterEach(async () => {
    // Keep DOM and store clean between runs
    app?.remove();
    store.delTable('docs');
    await persister.save();
    router.navigate('/');
  });

  it('displays empty state initially, creates a document, and views it in carousel', async () => {
    // 1. Verify empty state is displayed when there are no documents
    const emptyState = app.querySelector('.empty-state-card');
    expect(emptyState).to.exist;
    expect(emptyState.textContent).to.include('No documents yet');

    // 2. Create a new document with 1 sample page
    const docId = 'doc-' + Date.now();
    const docName = 'Invoice October 2026';
    const samplePage = {
      id: 'p1',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    };

    // Save the document via TinyBase store (simulates save)
    store.setRow('docs', docId, {
      name: docName,
      pages: JSON.stringify([samplePage]),
    });

    // Await Lit reactive update
    await app.updateComplete;

    // 3. Verify the document row is rendered in the list
    const docRow = app.querySelector(`copio-row[id="${docId}"]`);
    expect(docRow).to.exist;
    expect(docRow.getAttribute('name')).to.equal(docName);

    // Empty state should no longer exist
    expect(app.querySelector('.empty-state-card')).to.be.null;

    // 4. View the document (triggers route transition to /doc/{id})
    app.handleRowView({ detail: { id: docId } });
    await app.updateComplete;

    // 5. Verify the carousel view is activated with the document's pages
    expect(app.showCarousel).to.be.true;
    expect(router.getHashPath()).to.equal(`/doc/${docId}`);

    const carousel = app.querySelector('copio-carousel');
    expect(carousel).to.exist;
    expect(carousel.style.display).to.equal('block');
    expect(carousel.images).to.deep.equal([samplePage]);

    // Verify main item list is hidden while viewing carousel
    const itemsArticle = app.querySelector('.copio-items');
    expect(itemsArticle.style.display).to.equal('none');
  });

  it('renames a document and updates both UI and persisted store', async () => {
    const docId = 'doc-rename-test';
    const samplePage = {
      id: 'p1',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    };

    store.setRow('docs', docId, {
      name: 'Draft Document',
      pages: JSON.stringify([samplePage]),
    });
    await app.updateComplete;

    // Navigate to edit route
    app.handleRowEdit({ detail: { id: docId } });
    await app.updateComplete;

    const dialog = app.querySelector('copio-add-edit-dialog');
    expect(dialog).to.exist;

    const nameInput = dialog.querySelector('.dialog-add-edit-input-name');
    expect(nameInput.value).to.equal('Draft Document');

    // Change title
    nameInput.value = 'Finalized Document';

    // Click Save
    const saveBtn = dialog.querySelector('.dialog-add-edit-savebtn');
    saveBtn.click();
    await app.updateComplete;

    // Verify persisted store
    const updatedRow = store.getRow('docs', docId);
    expect(updatedRow.name).to.equal('Finalized Document');

    // Verify UI row has updated title
    const rowEl = app.querySelector(`copio-row[id="${docId}"]`);
    expect(rowEl).to.exist;
    expect(rowEl.getAttribute('name')).to.equal('Finalized Document');
  });

  it('deletes a document, removing it from store and restoring empty state', async () => {
    const docId = 'doc-delete-test';
    store.setRow('docs', docId, {
      name: 'Disposable Note',
      pages: JSON.stringify([]),
    });
    await app.updateComplete;

    expect(app.querySelector(`copio-row[id="${docId}"]`)).to.exist;
    expect(app.querySelector('.empty-state-card')).to.be.null;

    // Trigger row deletion
    app.handleRowDelete({ detail: { id: docId } });
    await app.updateComplete;

    // Verify store has removed the row
    expect(store.hasRow('docs', docId)).to.be.false;

    // Verify UI has removed the row and shows empty state
    expect(app.querySelector(`copio-row[id="${docId}"]`)).to.be.null;
    const emptyState = app.querySelector('.empty-state-card');
    expect(emptyState).to.exist;
    expect(emptyState.textContent).to.include('No documents yet');
  });

  it('persistence round-trip retains all edits and documents across simulated reload (persister.load())', async () => {
    const docId = 'doc-persist-test';
    const samplePage = {
      id: 'p1',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    };

    store.setRow('docs', docId, {
      name: 'Quarterly Report',
      pages: JSON.stringify([samplePage]),
    });
    await app.updateComplete;

    // Wait for any background persister activity to settle
    while (app.persister.getStatus() !== 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Explicitly persist to IndexedDB
    await app.persister.save();
    while (app.persister.getStatus() !== 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Pause autoSave so memory wipe doesn't overwrite IndexedDB
    await app.persister.stopAutoSave();

    // Clear in-memory docs table
    store.delTable('docs');
    await app.updateComplete;

    expect(store.hasRow('docs', docId)).to.be.false;
    expect(app.querySelector(`copio-row[id="${docId}"]`)).to.be.null;

    // Simulate page reload via persister.load()
    await app.persister.load();
    await app.updateComplete;

    // Resume autoSave
    app.persister.startAutoSave();

    // Verify store contains restored document
    expect(store.hasRow('docs', docId)).to.be.true;
    const restored = store.getRow('docs', docId);
    expect(restored.name).to.equal('Quarterly Report');
    expect(JSON.parse(restored.pages)).to.deep.equal([samplePage]);

    // Verify UI reflects restored document
    const rowEl = app.querySelector(`copio-row[id="${docId}"]`);
    expect(rowEl).to.exist;
    expect(rowEl.getAttribute('name')).to.equal('Quarterly Report');
  });
});

