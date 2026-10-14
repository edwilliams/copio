import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { docRepository } from '../js/services/doc-repository.js';
import { router } from '../js/core/router.js';
import notify from '../js/services/notify.js';
import * as exportUtils from '../js/services/export-utils.js';

describe('CPO-028: Action guards, in-place rename, and quick export in document view', () => {
  describe('CopioRow Action Guards & Contextual Menu State', () => {
    let row;

    afterEach(() => {
      row?.remove();
    });

    it('disables all export and OCR actions when document has no pages', async () => {
      row = document.createElement('copio-row');
      row.name = 'Empty Document';
      row.pages = [];
      document.body.appendChild(row);
      await row.updateComplete;

      const menu = row.shadowRoot.querySelector('sl-menu');
      expect(menu).to.exist;

      const pdfItem = menu.querySelector('sl-menu-item[value="download"]');
      const imagesItem = menu.querySelector('sl-menu-item[value="download-images"]');
      const mdItem = menu.querySelector('sl-menu-item[value="download-markdown"]');
      const ocrItem = menu.querySelector('sl-menu-item[value="extract-ocr"]');

      expect(pdfItem.hasAttribute('disabled')).to.be.true;
      expect(imagesItem.hasAttribute('disabled')).to.be.true;
      expect(mdItem.hasAttribute('disabled')).to.be.true;
      expect(ocrItem.hasAttribute('disabled')).to.be.true;

      expect(pdfItem.getAttribute('title')).to.include('empty');
      expect(ocrItem.getAttribute('title')).to.include('No image pages');
    });

    it('enables OCR and image exports, but disables markdown when doc has only images', async () => {
      row = document.createElement('copio-row');
      row.name = 'Scanned Document';
      row.pages = [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
      ];
      document.body.appendChild(row);
      await row.updateComplete;

      const menu = row.shadowRoot.querySelector('sl-menu');
      const pdfItem = menu.querySelector('sl-menu-item[value="download"]');
      const imagesItem = menu.querySelector('sl-menu-item[value="download-images"]');
      const mdItem = menu.querySelector('sl-menu-item[value="download-markdown"]');
      const ocrItem = menu.querySelector('sl-menu-item[value="extract-ocr"]');

      expect(pdfItem.hasAttribute('disabled')).to.be.false;
      expect(imagesItem.hasAttribute('disabled')).to.be.false;
      expect(ocrItem.hasAttribute('disabled')).to.be.false;
      expect(mdItem.hasAttribute('disabled')).to.be.true;
      expect(mdItem.getAttribute('title')).to.include('No markdown notes');
    });

    it('enables markdown export, but disables OCR when doc has only markdown notes', async () => {
      row = document.createElement('copio-row');
      row.name = 'Notes Document';
      row.pages = [
        { id: 'p1', type: 'markdown', name: 'Note 1', content: '# Meeting Notes' },
      ];
      document.body.appendChild(row);
      await row.updateComplete;

      const menu = row.shadowRoot.querySelector('sl-menu');
      const pdfItem = menu.querySelector('sl-menu-item[value="download"]');
      const imagesItem = menu.querySelector('sl-menu-item[value="download-images"]');
      const mdItem = menu.querySelector('sl-menu-item[value="download-markdown"]');
      const ocrItem = menu.querySelector('sl-menu-item[value="extract-ocr"]');

      expect(pdfItem.hasAttribute('disabled')).to.be.false;
      expect(imagesItem.hasAttribute('disabled')).to.be.false;
      expect(mdItem.hasAttribute('disabled')).to.be.false;
      expect(ocrItem.hasAttribute('disabled')).to.be.true;
    });
  });

  describe('CopioRow In-Place Document Rename', () => {
    let row;

    afterEach(() => {
      row?.remove();
    });

    it('switches to inline rename mode and emits copio-row:rename upon save', async () => {
      row = document.createElement('copio-row');
      row.setAttribute('id', 'doc-123');
      row.name = 'Original Name';
      document.body.appendChild(row);
      await row.updateComplete;

      expect(row.isRenaming).to.be.false;

      // Start rename via startRename
      row.startRename();
      await row.updateComplete;

      expect(row.isRenaming).to.be.true;
      const input = row.shadowRoot.querySelector('.rename-input');
      expect(input).to.exist;
      expect(input.value).to.equal('Original Name');

      let renameEvent = null;
      row.addEventListener('copio-row:rename', (e) => {
        renameEvent = e.detail;
      });

      // Modify renameValue and commit
      row.renameValue = 'Renamed Document';
      row.commitRename();
      await row.updateComplete;

      expect(row.isRenaming).to.be.false;
      expect(row.name).to.equal('Renamed Document');
      expect(renameEvent).to.deep.equal({ id: 'doc-123', name: 'Renamed Document' });
    });

    it('cancels rename without emitting changes on cancel', async () => {
      row = document.createElement('copio-row');
      row.setAttribute('id', 'doc-123');
      row.name = 'Initial Title';
      document.body.appendChild(row);
      await row.updateComplete;

      row.startRename();
      await row.updateComplete;

      let renameEvent = null;
      row.addEventListener('copio-row:rename', (e) => {
        renameEvent = e.detail;
      });

      row.renameValue = 'Should Not Persist';
      row.cancelRename();
      await row.updateComplete;

      expect(row.isRenaming).to.be.false;
      expect(row.name).to.equal('Initial Title');
      expect(renameEvent).to.be.null;
    });
  });

  describe('CopioCarousel Quick Export in Document View', () => {
    let carousel;

    afterEach(() => {
      carousel?.remove();
    });

    it('renders document title and quick export action bar', async () => {
      carousel = document.createElement('copio-carousel');
      carousel.docId = 'doc-456';
      carousel.docName = 'Project Proposal';
      carousel.images = [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
      ];
      document.body.appendChild(carousel);
      await carousel.updateComplete;

      const titleEl = carousel.shadowRoot.querySelector('.doc-heading');
      expect(titleEl).to.exist;
      expect(titleEl.textContent).to.equal('Project Proposal');

      const exportTrigger = carousel.shadowRoot.querySelector('.export-btn');
      expect(exportTrigger).to.exist;

      const exportMenu = carousel.shadowRoot.querySelector('sl-dropdown sl-menu');
      expect(exportMenu).to.exist;

      const pdfItem = exportMenu.querySelector('sl-menu-item[value="pdf"]');
      const imagesItem = exportMenu.querySelector('sl-menu-item[value="images"]');
      const mdItem = exportMenu.querySelector('sl-menu-item[value="markdown"]');

      expect(pdfItem.hasAttribute('disabled')).to.be.false;
      expect(imagesItem.hasAttribute('disabled')).to.be.false;
      expect(mdItem.hasAttribute('disabled')).to.be.true; // No markdown pages
    });

    it('dispatches export events when menu items are selected', async () => {
      carousel = document.createElement('copio-carousel');
      carousel.docId = 'doc-456';
      carousel.docName = 'Project Proposal';
      carousel.images = [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
        { id: 'p2', type: 'markdown', name: 'Notes', content: '# Notes' },
      ];
      document.body.appendChild(carousel);
      await carousel.updateComplete;

      let pdfDetail = null;
      let imagesDetail = null;
      let mdDetail = null;

      carousel.addEventListener('copio-carousel:download-pdf', (e) => (pdfDetail = e.detail));
      carousel.addEventListener('copio-carousel:download-images', (e) => (imagesDetail = e.detail));
      carousel.addEventListener('copio-carousel:download-markdown', (e) => (mdDetail = e.detail));

      carousel.handleExportSelect({ detail: { item: { value: 'pdf' } } });
      carousel.handleExportSelect({ detail: { item: { value: 'images' } } });
      carousel.handleExportSelect({ detail: { item: { value: 'markdown' } } });

      expect(pdfDetail).to.deep.include({ docId: 'doc-456', docName: 'Project Proposal' });
      expect(imagesDetail).to.deep.include({ docId: 'doc-456', docName: 'Project Proposal' });
      expect(mdDetail).to.deep.include({ docId: 'doc-456', docName: 'Project Proposal' });
    });
  });

  describe('CopioApp Integration: Row Rename and Carousel Export Wiring', () => {
    let app;

    beforeEach(async () => {
      await docRepository.init();
      // Clean docs
      const existing = await docRepository.listDocs();
      for (const d of existing) {
        await docRepository.deleteDoc(d.id);
      }
      router.navigate('/');

      app = document.createElement('copio-app');
      document.body.appendChild(app);
      await app.updateComplete;
    });

    afterEach(async () => {
      app?.remove();
      const existing = await docRepository.listDocs();
      for (const d of existing) {
        await docRepository.deleteDoc(d.id);
      }
      router.navigate('/');
    });

    it('renames document in repository when copio-row:rename is fired', async () => {
      const created = await docRepository.createDoc('Initial Name', [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
      ]);
      await app.updateComplete;

      const row = app.querySelector(`copio-row[id="${created.id}"]`);
      expect(row).to.exist;

      // Simulate rename event from row
      row.dispatchEvent(
        new CustomEvent('copio-row:rename', {
          bubbles: true,
          composed: true,
          detail: { id: created.id, name: 'Updated via Row' },
        }),
      );

      // Allow async rename handler to run
      await new Promise((r) => setTimeout(r, 50));

      const updated = await docRepository.getDoc(created.id);
      expect(updated.name).to.equal('Updated via Row');
    });
  });
});
