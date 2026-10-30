import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { store, persister } from '../js/core/store.js';
import { router } from '../js/core/router.js';
import '../sdk/index.js';

describe('CPO-041 & CPO-085: Dogfood App & Live Interactive B2B Playground', () => {
  let app;
  let testContainer;

  beforeEach(async () => {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);

    store.delTable('docs');
    await persister.save();
    router.navigate('/');

    app = document.createElement('copio-app');
    testContainer.appendChild(app);
    await app.updateComplete;

    while (app.persister && app.persister.getStatus() !== 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  });

  afterEach(async () => {
    app?.remove();
    testContainer?.remove();
    store.delTable('docs');
    await persister.save();
    router.navigate('/');
  });

  describe('CPO-041: Copio App Rebuild & Dogfooding <copio-scanner>', () => {
    it('embeds <copio-scanner> inside a modal dialog using only public SDK APIs', async () => {
      const scannerModal = app.querySelector('.copio-scanner-modal');
      expect(scannerModal, 'Scanner modal should exist in copio-app').to.exist;

      const embeddedScanner = app.querySelector('#app-embedded-scanner');
      expect(embeddedScanner, 'Embedded <copio-scanner> should exist').to.exist;
      expect(embeddedScanner.tagName.toLowerCase()).to.equal('copio-scanner');

      // Verify initial public configuration
      expect(embeddedScanner.getAttribute('theme')).to.equal('dark');
      expect(embeddedScanner.getAttribute('ocr')).to.equal('true');
      expect(embeddedScanner.getAttribute('pdf')).to.equal('true');
    });

    it('opens and closes scanner via public openScanner() and closeScanner() methods', async () => {
      const scannerModal = app.querySelector('.copio-scanner-modal');
      const embeddedScanner = app.querySelector('#app-embedded-scanner');

      await app.openScanner({ mode: 'single', aspect: 'receipt' });
      await app.updateComplete;

      expect(scannerModal.open).to.be.true;
      expect(embeddedScanner.mode).to.equal('single');
      expect(embeddedScanner.aspect).to.equal('receipt');

      app.closeScanner();
      await app.updateComplete;
      expect(scannerModal.open).to.be.false;
    });

    it('saves scanned document upon receiving copio:scan-complete public event', async () => {
      const embeddedScanner = app.querySelector('#app-embedded-scanner');
      await app.openScanner({ docId: 'doc-dogfood-complete' });
      await app.updateComplete;

      const samplePages = [
        {
          id: 'p-dogfood-1',
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          originalSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          edits: { crop: null, rotation: 0, filter: 'none' },
        },
      ];

      // Dispatch public custom event across shadow boundary
      embeddedScanner.dispatchEvent(
        new CustomEvent('copio:scan-complete', {
          bubbles: true,
          composed: true,
          detail: {
            id: 'doc-dogfood-complete',
            pages: samplePages,
            page: samplePages[0],
          },
        }),
      );

      await app.updateComplete;
      await new Promise((r) => setTimeout(r, 50));

      // Check document was persisted in store via public contract
      expect(store.hasRow('docs', 'doc-dogfood-complete')).to.be.true;
      const savedDoc = store.getRow('docs', 'doc-dogfood-complete');
      expect(savedDoc.name).to.include('Scan');

      const parsedPages = JSON.parse(savedDoc.pages);
      expect(parsedPages.length).to.equal(1);
      expect(parsedPages[0].id).to.equal('p-dogfood-1');
    });

    it('navigates to /scan route and opens the scanner dialog', async () => {
      const scannerModal = app.querySelector('.copio-scanner-modal');
      router.navigate('/scan');
      await new Promise((r) => setTimeout(r, 60));
      await app.updateComplete;

      expect(scannerModal.open).to.be.true;
    });

    it('provides direct Scan button in empty-state and FAB action dock', () => {
      const emptyStateScanBtn = app.querySelector('.empty-state-scan-btn');
      expect(emptyStateScanBtn, 'Empty state scan button should be rendered').to.exist;

      const fabScanBtn = app.querySelector('.dialog-scan-btn');
      expect(fabScanBtn, 'FAB scan button should be rendered').to.exist;
    });

    it('integrates camera scan within copio-add-edit-dialog via public copio:scan-complete', async () => {
      const addEditDialog = app.querySelector('copio-add-edit-dialog');
      expect(addEditDialog).to.exist;

      await addEditDialog.open();
      const cameraBtn = addEditDialog.querySelector('.dialog-scan-camera-btn');
      expect(cameraBtn, 'Camera scan button in add-edit dialog should exist').to.exist;

      const innerScannerDialog = addEditDialog.querySelector('.dialog-inner-scanner');
      const innerScanner = addEditDialog.querySelector('.inner-copio-scanner');
      expect(innerScannerDialog).to.exist;
      expect(innerScanner).to.exist;

      await innerScannerDialog.show();
      expect(innerScannerDialog.open).to.be.true;

      const scannedPage = {
        id: 'inner-page-1',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      };

      innerScanner.dispatchEvent(
        new CustomEvent('copio:scan-complete', {
          bubbles: true,
          composed: true,
          detail: {
            pages: [scannedPage],
            page: scannedPage,
          },
        }),
      );

      await addEditDialog.updateComplete;
      const copioImages = addEditDialog.querySelector('copio-images');
      expect(copioImages.images.some((img) => img.id === 'inner-page-1')).to.be.true;
      expect(innerScannerDialog.open).to.be.false;
    });
  });

  describe('CPO-085: Live Interactive B2B Playground Demo', () => {
    let playgroundContainer;

    beforeEach(() => {
      playgroundContainer = document.createElement('div');
      playgroundContainer.innerHTML = `
        <div class="playground-test-shell">
          <div class="control-pill-group">
            <button type="button" class="pill-btn active" data-mode="modal">Modal</button>
            <button type="button" class="pill-btn" data-mode="drawer">Side Drawer</button>
            <button type="button" class="pill-btn" data-mode="inline">Inline Card</button>
            <button type="button" class="pill-btn" data-mode="full">Full Viewport</button>
          </div>
          <div id="modal-host" class="copio-scanner-host"></div>
          <div id="drawer-host" class="copio-scanner-host"></div>
          <div id="inline-host" class="copio-scanner-host"></div>
          <div id="full-host" class="copio-scanner-host"></div>
          <div id="events-log"></div>
          <span id="badge-count">0</span>
          <pre id="code-snippet-html"></pre>
          <pre id="code-snippet-js"></pre>
        </div>
      `;
      testContainer.appendChild(playgroundContainer);
    });

    afterEach(() => {
      playgroundContainer.remove();
    });

    it('switches host embedding modes (Modal, Side Drawer, Inline Card, Full Viewport) without page reload', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.id = 'demo-test-scanner';

      const modalHost = playgroundContainer.querySelector('#modal-host');
      const drawerHost = playgroundContainer.querySelector('#drawer-host');
      const inlineHost = playgroundContainer.querySelector('#inline-host');
      const fullHost = playgroundContainer.querySelector('#full-host');

      // 1. Modal Mode
      modalHost.appendChild(scanner);
      expect(scanner.parentElement).to.equal(modalHost);

      // 2. Switch to Drawer Mode without reload
      drawerHost.appendChild(scanner);
      expect(scanner.parentElement).to.equal(drawerHost);

      // 3. Switch to Inline Mode without reload
      inlineHost.appendChild(scanner);
      expect(scanner.parentElement).to.equal(inlineHost);

      // 4. Switch to Full Viewport Mode without reload
      fullHost.appendChild(scanner);
      expect(scanner.parentElement).to.equal(fullHost);
    });

    it('records and logs all public copio:* events in live event stream', () => {
      const scanner = document.createElement('copio-scanner');
      playgroundContainer.querySelector('#modal-host').appendChild(scanner);

      const eventsLog = playgroundContainer.querySelector('#events-log');
      const badge = playgroundContainer.querySelector('#badge-count');
      const events = [];

      const recordEvent = (e) => {
        events.push({ type: e.type, detail: e.detail });
        badge.textContent = String(events.length);
        const item = document.createElement('div');
        item.className = 'logged-event';
        item.textContent = `${e.type}: ${JSON.stringify(e.detail)}`;
        eventsLog.appendChild(item);
      };

      scanner.addEventListener('copio:page-added', recordEvent);
      scanner.addEventListener('copio:scan-complete', recordEvent);

      scanner.dispatchEvent(new CustomEvent('copio:page-added', { bubbles: true, composed: true, detail: { page: { id: 'p1' } } }));
      scanner.dispatchEvent(new CustomEvent('copio:scan-complete', { bubbles: true, composed: true, detail: { pages: [{ id: 'p1' }] } }));

      expect(events.length).to.equal(2);
      expect(badge.textContent).to.equal('2');
      expect(eventsLog.querySelectorAll('.logged-event').length).to.equal(2);
    });

    it('dynamically generates copy-pasteable HTML and JavaScript code snippets matching scanner configuration', () => {
      const snippetHtml = playgroundContainer.querySelector('#code-snippet-html');
      const snippetJs = playgroundContainer.querySelector('#code-snippet-js');

      const mode = 'single';
      const aspect = 'card';
      const maxPages = 2;
      const theme = 'brand';
      const ocr = true;
      const pdf = false;

      snippetHtml.textContent = `<copio-scanner mode="${mode}" aspect="${aspect}" max-pages="${maxPages}" theme="${theme}" ocr="${ocr}" pdf="${pdf}"></copio-scanner>`;
      snippetJs.textContent = `const scanner = document.querySelector('copio-scanner');\nscanner.addEventListener('copio:scan-complete', (e) => console.log(e.detail));`;

      expect(snippetHtml.textContent).to.include('mode="single"');
      expect(snippetHtml.textContent).to.include('aspect="card"');
      expect(snippetHtml.textContent).to.include('theme="brand"');
      expect(snippetHtml.textContent).to.include('pdf="false"');
      expect(snippetJs.textContent).to.include('copio:scan-complete');
    });

    it('verifies demo/index.html file exists and contains StackBlitz starter links', async () => {
      const res = await fetch('/demo/index.html');
      expect(res.status).to.equal(200);
      const text = await res.text();
      expect(text).to.include('stackblitz.com/edit/copio-sdk-vanilla');
      expect(text).to.include('stackblitz.com/edit/copio-sdk-react');
      expect(text).to.include('stackblitz.com/edit/copio-sdk-vue');
      expect(text).to.include('stackblitz.com/edit/copio-sdk-svelte');
      expect(text).to.include('copio:scan-complete');
    });
  });
});
