import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import {
  CopioScanner,
  CopioEngine,
  COPIO_EVENTS,
  dispatchCopioEvent,
  MemoryStorageAdapter,
} from '../sdk/index.js';
import { CopioRow } from '../js/routes/home/copio-row.js';
import { CopioAddEditDialog } from '../js/routes/add-edit/copio-add-edit-dialog.js';
import { CopioCarousel } from '../js/routes/doc/copio-carousel.js';
import { CopioSyncDialog } from '../js/routes/sync/copio-sync-dialog.js';
import { CopioHeader } from '../js/components/copio-header.js';
import { CopioDocOcrDialog } from '../js/routes/ocr/copio-doc-ocr-dialog.js';
import { getAssetBase, setAssetBase } from '../js/utils/module-loader.js';

async function createDummyImageFile(width = 20, height = 20, color = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return new File([blob], 'sample-page.png', { type: 'image/png' });
}

describe('SDK Public API Surface (Group D: CPO-035, CPO-036, CPO-037)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    setAssetBase('.');
    container.remove();
  });

  describe('CPO-035: Configuration API', () => {
    it('initializes with default attribute/property values', () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      expect(scanner.mode).to.equal('document');
      expect(scanner.docId).to.be.null;
      expect(scanner.features).to.include('crop');
      expect(scanner.features).to.include('ocr');
      expect(scanner.features).to.include('export');
      expect(scanner.exportFormats).to.deep.equal(['pdf', 'zip', 'png', 'jpg']);
      expect(scanner.ocrLanguages).to.deep.equal(['eng']);
      expect(scanner.maxPages).to.equal(0);
    });

    it('reflects attributes to properties and responds to attribute changes', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'single');
      scanner.setAttribute('doc-id', 'doc-123');
      scanner.setAttribute('features', 'crop rotate export');
      scanner.setAttribute('export-formats', 'pdf,zip');
      scanner.setAttribute('ocr-languages', 'eng,deu');
      scanner.setAttribute('max-pages', '25');
      scanner.setAttribute('asset-base', 'https://cdn.example.com/assets');
      scanner.setAttribute('license-key', 'TEST-KEY-XYZ');
      container.appendChild(scanner);

      expect(scanner.mode).to.equal('single');
      expect(scanner.docId).to.equal('doc-123');
      expect(scanner.features).to.deep.equal(['crop', 'rotate', 'export']);
      expect(scanner.hasFeature('crop')).to.be.true;
      expect(scanner.hasFeature('ocr')).to.be.false;
      expect(scanner.exportFormats).to.deep.equal(['pdf', 'zip']);
      expect(scanner.ocrLanguages).to.deep.equal(['eng', 'deu']);
      expect(scanner.maxPages).to.equal(25);
      expect(scanner.assetBase).to.equal('https://cdn.example.com/assets');
      expect(scanner.licenseKey).to.equal('TEST-KEY-XYZ');
    });

    it('reflects property updates to attributes and underlying engine', () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      scanner.mode = 'single';
      expect(scanner.getAttribute('mode')).to.equal('single');

      scanner.features = ['crop', 'filter'];
      expect(scanner.hasFeature('crop')).to.be.true;
      expect(scanner.hasFeature('filter')).to.be.true;
      expect(scanner.hasFeature('ocr')).to.be.false;

      scanner.exportFormats = ['pdf'];
      expect(scanner.exportFormats).to.deep.equal(['pdf']);

      scanner.ocrLanguages = ['fra', 'spa'];
      expect(scanner.ocrLanguages).to.deep.equal(['fra', 'spa']);

      scanner.maxPages = 5;
      expect(scanner.maxPages).to.equal(5);

      scanner.assetBase = 'https://custom-assets.example.com';
      expect(getAssetBase()).to.equal('https://custom-assets.example.com');
    });

    it('allows setting pluggable storage adapter via .storage property', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      const memAdapter = new MemoryStorageAdapter();
      scanner.storage = memAdapter;

      expect(scanner.storage).to.equal(memAdapter);
      expect(scanner.engine.storage).to.equal(memAdapter);

      await scanner.engine.createDocument('Custom Doc', []);
      const docs = await scanner.engine.listDocuments();
      expect(docs.length).to.equal(1);
      expect(docs[0].name).to.equal('Custom Doc');
    });

    it('feature gating: disabled features throw error and prevent execution', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.features = ['crop']; // OCR and export disabled
      container.appendChild(scanner);

      let errorCaught = null;
      let errorEventFired = null;
      scanner.addEventListener(COPIO_EVENTS.ERROR, (e) => {
        errorEventFired = e.detail;
      });

      try {
        await scanner.ocr();
      } catch (err) {
        errorCaught = err;
      }

      expect(errorCaught).to.not.be.null;
      expect(errorCaught.message).to.include('Feature "ocr" is disabled');
      expect(errorEventFired).to.not.be.null;
      expect(errorEventFired.code).to.equal('FEATURE_DISABLED');

      let exportError = null;
      try {
        await scanner.exportPdf();
      } catch (err) {
        exportError = err;
      }
      expect(exportError).to.not.be.null;
      expect(exportError.message).to.include('Feature "export" is disabled');
    });
  });

  describe('CPO-036: Public Events API & Internal Cleanup', () => {
    it('public events have bubbles: true and composed: true to cross shadow boundary', () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      let eventReceived = null;
      container.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => {
        eventReceived = e;
      });

      const dispatched = dispatchCopioEvent(scanner.shadowRoot || scanner, COPIO_EVENTS.PAGE_ADDED, {
        page: { id: 'p1', src: 'data:...' },
        pageNumber: 1,
      });

      expect(dispatched.bubbles).to.be.true;
      expect(dispatched.composed).to.be.true;
      expect(eventReceived).to.not.be.null;
      expect(eventReceived.detail.pageNumber).to.equal(1);
    });

    it('internal component events have composed: false and do not leak across shadow roots', () => {
      const shadowHost = document.createElement('div');
      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      container.appendChild(shadowHost);

      const row = document.createElement('copio-row');
      row.setAttribute('id', 'doc-123');
      row.name = 'Old Name';
      shadowRoot.appendChild(row);

      let hostReceivedDocDelete = false;
      container.addEventListener('doc:delete', () => {
        hostReceivedDocDelete = true;
      });

      row.handleDelete();

      expect(hostReceivedDocDelete).to.be.false; // Did not leak through shadow boundary
    });

    it('internal components dispatch clean domain events', async () => {
      const row = document.createElement('copio-row');
      row.setAttribute('id', 'doc-test');
      container.appendChild(row);
      await row.updateComplete;

      let receivedEvent = null;
      row.addEventListener('doc:view', (e) => {
        receivedEvent = e.detail;
      });

      row.handleView();
      expect(receivedEvent).to.deep.equal({ id: 'doc-test' });

      let renameEvent = null;
      row.addEventListener('doc:rename', (e) => {
        renameEvent = e.detail;
      });
      row.name = 'Initial';
      row.renameValue = 'Updated';
      row.commitRename();
      expect(renameEvent).to.deep.equal({ id: 'doc-test', name: 'Updated' });
    });

    it('add-edit dialog dispatches clean dialog:close and dialog:save events', async () => {
      const dialog = document.createElement('copio-add-edit-dialog');
      container.appendChild(dialog);
      await dialog.updateComplete;

      let closeReceived = false;
      dialog.addEventListener('dialog:close', () => {
        closeReceived = true;
      });

      const slDialog = dialog.querySelector('sl-dialog');
      if (slDialog) {
        slDialog.dispatchEvent(new CustomEvent('sl-after-hide', { bubbles: false }));
      }
      expect(closeReceived).to.be.true;
    });

    it('sync dialog dispatches clean dialog:close event', () => {
      const syncDialog = document.createElement('copio-sync-dialog');
      syncDialog.syncState = { step: 'waiting', qrSvg: '<svg></svg>', url: 'https://example.com' };
      container.appendChild(syncDialog);

      let closeFired = false;
      syncDialog.addEventListener('dialog:close', () => {
        closeFired = true;
      });

      syncDialog.closeSyncDialog();
      expect(closeFired).to.be.true;
    });

    it('header dispatches clean header:link-device and header:clear-cache events', async () => {
      const header = document.createElement('copio-header');
      container.appendChild(header);
      await header.updateComplete;

      let linkFired = false;
      let clearFired = false;
      header.addEventListener('header:link-device', () => (linkFired = true));
      header.addEventListener('header:clear-cache', () => (clearFired = true));

      const root = header.shadowRoot || header;
      const menu = root.querySelector('sl-menu');
      expect(menu).to.exist;
      menu.dispatchEvent(new CustomEvent('sl-select', {
        detail: { item: { value: 'link-device' } },
        bubbles: true,
        composed: true,
      }));
      menu.dispatchEvent(new CustomEvent('sl-select', {
        detail: { item: { value: 'clear-cache' } },
        bubbles: true,
        composed: true,
      }));

      expect(linkFired).to.be.true;
      expect(clearFired).to.be.true;
    });
  });

  describe('CPO-037: Public Methods API', () => {
    it('open() and close() manage scanner visibility state', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      await scanner.open();
      await scanner.close();
    });

    it('addFiles(), getPages(), and clear() manipulate document pages and emit public events', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.storage = new MemoryStorageAdapter();
      container.appendChild(scanner);

      const addedEvents = [];
      scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => addedEvents.push(e.detail));

      let pagesChangedFired = false;
      scanner.addEventListener(COPIO_EVENTS.PAGES_CHANGED, () => {
        pagesChangedFired = true;
      });

      const file = await createDummyImageFile();
      const added = await scanner.addFiles([file]);

      expect(added.length).to.equal(1);
      expect(addedEvents.length).to.equal(1);
      expect(pagesChangedFired).to.be.true;

      const pages = await scanner.getPages();
      expect(pages.length).to.equal(1);

      await scanner.clear();
      const clearedPages = await scanner.getPages();
      expect(clearedPages.length).to.equal(0);
    });

    it('exportPdf() returns a Blob and does NOT trigger download by default', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.storage = new MemoryStorageAdapter();
      container.appendChild(scanner);

      const file = await createDummyImageFile();
      await scanner.addFiles([file]);

      let anchorClicked = false;
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = () => {
        anchorClicked = true;
      };

      let exportCompleteEvent = null;
      scanner.addEventListener(COPIO_EVENTS.EXPORT_COMPLETE, (e) => {
        exportCompleteEvent = e.detail;
      });

      try {
        const blob = await scanner.exportPdf();

        expect(blob).to.be.instanceOf(Blob);
        expect(blob.type).to.equal('application/pdf');
        expect(anchorClicked).to.be.false; // No download triggered!
        expect(exportCompleteEvent).to.not.be.null;
        expect(exportCompleteEvent.type).to.equal('pdf');
      } finally {
        HTMLAnchorElement.prototype.click = originalClick;
      }
    });

    it('exportZip() returns a Blob and does NOT trigger download by default', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.storage = new MemoryStorageAdapter();
      container.appendChild(scanner);

      const file1 = await createDummyImageFile(20, 20, '#ff0000');
      const file2 = await createDummyImageFile(20, 20, '#00ff00');
      await scanner.addFiles([file1, file2]);

      let anchorClicked = false;
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = () => {
        anchorClicked = true;
      };

      let exportCompleteEvent = null;
      scanner.addEventListener(COPIO_EVENTS.EXPORT_COMPLETE, (e) => {
        exportCompleteEvent = e.detail;
      });

      try {
        const blob = await scanner.exportZip();

        expect(blob).to.be.instanceOf(Blob);
        expect(anchorClicked).to.be.false; // No download triggered!
        expect(exportCompleteEvent).to.not.be.null;
        expect(exportCompleteEvent.type).to.equal('zip');
      } finally {
        HTMLAnchorElement.prototype.click = originalClick;
      }
    });

    it('headless CopioEngine methods operate independently of the DOM', async () => {
      const engine = new CopioEngine({
        storage: new MemoryStorageAdapter(),
      });

      const file = await createDummyImageFile();
      const pages = await engine.addFiles([file]);
      expect(pages.length).to.equal(1);

      const docPages = await engine.getPages();
      expect(docPages.length).to.equal(1);

      const pdfBlob = await engine.exportPdf();
      expect(pdfBlob).to.be.instanceOf(Blob);

      await engine.clear();
      expect((await engine.getPages()).length).to.equal(0);
    });
  });
});
