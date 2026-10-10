import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { store } from '../js/core/store.js';
import { router } from '../js/core/router.js';

describe('Document Flow: create and view a document', () => {
  let app;

  beforeEach(async () => {
    // Start with a clean docs table and home route
    store.setTable('docs', {});
    router.navigate('/');

    // Mount copio-app into the test page
    app = document.createElement('copio-app');
    document.body.appendChild(app);
    await app.updateComplete;
  });

  afterEach(() => {
    // Keep DOM clean between runs
    app?.remove();
    store.setTable('docs', {});
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
});
