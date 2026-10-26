import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import '../sdk/scanner.js';
import { store, persister } from '../js/core/store.js';
import { router } from '../js/core/router.js';
import notify, { setContainer, clear } from '../js/services/notify.js';

describe('Constrained-Container Layout Pass (CPO-024)', () => {
  let hostFrame;
  let scanner;
  let app;

  const SIZES = [
    { name: '360x640 Compact Modal', width: 360, height: 640, breakpoint: 'compact' },
    { name: '480x800 Sidebar Drawer', width: 480, height: 800, breakpoint: 'sidebar' },
    { name: '400x800 Narrow Drawer', width: 400, height: 800, breakpoint: 'compact' },
    { name: '800x500 Wide Embed', width: 800, height: 500, breakpoint: 'full' },
    { name: '100% Full View', width: 1024, height: 768, breakpoint: 'full' },
  ];

  beforeEach(async () => {
    store.delTable('docs');
    await persister.save();
    router.navigate('/');
    clear();
    setContainer(null);
  });

  afterEach(async () => {
    clear();
    setContainer(null);
    if (app) app.remove();
    if (scanner) scanner.remove();
    if (hostFrame) hostFrame.remove();
    store.delTable('docs');
    await persister.save();
    router.navigate('/');
  });

  function createHostFrame(width, height) {
    const frame = document.createElement('div');
    frame.className = 'host-container-frame copio-scanner-host';
    frame.style.position = 'relative';
    frame.style.width = typeof width === 'number' ? `${width}px` : width;
    frame.style.height = typeof height === 'number' ? `${height}px` : height;
    frame.style.overflow = 'hidden';
    frame.style.boxSizing = 'border-box';
    document.body.appendChild(frame);
    return frame;
  }

  describe('1. Container Query Layout Architecture & Breakpoints', () => {
    it('establishes container query context on copio-scanner and .copio-scanner-host', () => {
      hostFrame = createHostFrame(360, 640);
      const computed = window.getComputedStyle(hostFrame);
      expect(computed.containerType).to.include('size');
      expect(computed.containerName).to.include('copio-scanner');
    });

    it('establishes container query context on copio-scanner web component :host', async () => {
      scanner = document.createElement('copio-scanner');
      document.body.appendChild(scanner);
      const computed = window.getComputedStyle(scanner);
      expect(computed.containerType).to.include('size');
      expect(computed.containerName).to.include('copio-scanner');
    });

    it('establishes container query context on copio-app', async () => {
      app = document.createElement('copio-app');
      document.body.appendChild(app);
      await app.updateComplete;
      const computed = window.getComputedStyle(app);
      expect(computed.containerType).to.include('size');
      expect(computed.containerName).to.include('copio-scanner');
    });

    for (const size of SIZES) {
      it(`renders copio-app at ${size.name} (${size.width}×${size.height}) with zero horizontal overflow`, async () => {
        hostFrame = createHostFrame(size.width, size.height);
        app = document.createElement('copio-app');
        hostFrame.appendChild(app);
        await app.updateComplete;

        const frameRect = hostFrame.getBoundingClientRect();
        const appRect = app.getBoundingClientRect();

        expect(appRect.width).to.be.at.most(frameRect.width + 1);
        expect(appRect.height).to.be.at.most(frameRect.height + 1);

        // Verify no horizontal overflow in container
        expect(hostFrame.scrollWidth).to.be.at.most(hostFrame.clientWidth + 1);
      });
    }
  });

  describe('2. Elimination of Viewport Units (vw/vh) & Position Fixed', () => {
    it('empty state uses container-relative height instead of 100vh', async () => {
      hostFrame = createHostFrame(360, 640);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      const emptyState = app.querySelector('.empty-state');
      expect(emptyState).to.exist;

      const emptyRect = emptyState.getBoundingClientRect();
      const frameRect = hostFrame.getBoundingClientRect();

      // Empty state should be completely inside the 640px box, NOT 100vh of window (which might be 900+ px)
      expect(emptyRect.height).to.be.at.most(frameRect.height);
      expect(emptyRect.bottom).to.be.at.most(frameRect.bottom + 1);
    });

    it('floating action button (Add New) is positioned within container, not viewport bottom', async () => {
      hostFrame = createHostFrame(360, 640);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      const fabWrap = app.querySelector('.copio-fab-wrap');
      expect(fabWrap).to.exist;

      const fabRect = fabWrap.getBoundingClientRect();
      const frameRect = hostFrame.getBoundingClientRect();

      // FAB must stay inside host container boundaries
      expect(fabRect.bottom).to.be.at.most(frameRect.bottom + 2);
      expect(fabRect.right).to.be.at.most(frameRect.right + 2);
      expect(fabRect.top).to.be.at.least(frameRect.top);
      expect(fabRect.left).to.be.at.least(frameRect.left);
    });
  });

  describe('3. Strict Scoping of Dialogs to Host Element', () => {
    it('scopes copio-add-edit-dialog overlay and panel inside 360x640 container', async () => {
      hostFrame = createHostFrame(360, 640);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      const addDialog = app.querySelector('copio-add-edit-dialog');
      expect(addDialog).to.exist;

      await addDialog.open();

      const slDialog = addDialog.querySelector('sl-dialog');
      expect(slDialog).to.exist;

      const panel = slDialog.shadowRoot.querySelector('[part~="panel"]');
      const overlay = slDialog.shadowRoot.querySelector('[part~="overlay"]');
      expect(panel).to.exist;
      expect(overlay).to.exist;

      const frameRect = hostFrame.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();

      // Panel must stay inside host container
      expect(panelRect.width).to.be.at.most(frameRect.width);
      expect(panelRect.height).to.be.at.most(frameRect.height);
      expect(panelRect.left).to.be.at.least(frameRect.left - 1);
      expect(panelRect.right).to.be.at.most(frameRect.right + 1);

      // Overlay must not leak outside host container
      expect(overlayRect.left).to.be.at.least(frameRect.left - 1);
      expect(overlayRect.right).to.be.at.most(frameRect.right + 1);
      expect(overlayRect.top).to.be.at.least(frameRect.top - 1);
      expect(overlayRect.bottom).to.be.at.most(frameRect.bottom + 1);
    });

    it('scopes copio-doc-ocr-dialog inside 480x800 container without overflowing', async () => {
      hostFrame = createHostFrame(480, 800);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      const ocrDialog = app.querySelector('copio-doc-ocr-dialog');
      expect(ocrDialog).to.exist;

      ocrDialog.open('doc-1', 'Receipt Sample', [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
      ]);
      await ocrDialog.updateComplete;

      const slDialog = ocrDialog.querySelector('sl-dialog');
      expect(slDialog).to.exist;

      const panel = slDialog.shadowRoot.querySelector('[part~="panel"]');
      expect(panel).to.exist;

      const frameRect = hostFrame.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      expect(panelRect.width).to.be.at.most(frameRect.width);
      expect(panelRect.height).to.be.at.most(frameRect.height);
      expect(panelRect.left).to.be.at.least(frameRect.left - 1);
      expect(panelRect.right).to.be.at.most(frameRect.right + 1);

      ocrDialog.close();
    });

    it('scopes copio-sync-dialog inside 400x800 container', async () => {
      hostFrame = createHostFrame(400, 800);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      app.syncState = {
        mode: 'host',
        step: 'awaiting-peer',
        peerId: 'peer-test-123',
        errorMessage: null,
      };
      await app.updateComplete;

      const syncDialog = app.querySelector('copio-sync-dialog');
      expect(syncDialog).to.exist;
      await syncDialog.updateComplete;

      const slDialog = syncDialog.querySelector('sl-dialog');
      expect(slDialog).to.exist;

      const panel = slDialog.shadowRoot.querySelector('[part~="panel"]');
      expect(panel).to.exist;

      const frameRect = hostFrame.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      expect(panelRect.width).to.be.at.most(frameRect.width);
      expect(panelRect.height).to.be.at.most(frameRect.height);
      expect(panelRect.left).to.be.at.least(frameRect.left - 1);
      expect(panelRect.right).to.be.at.most(frameRect.right + 1);

      app.closeSyncDialog();
    });

    it('scopes crop and text dialogs inside copio-images Shadow DOM', async () => {
      hostFrame = createHostFrame(360, 640);
      const images = document.createElement('copio-images');
      hostFrame.appendChild(images);

      images.images = [
        { id: 'p1', type: 'markdown', name: 'Note 1', content: 'Sample text' },
      ];

      const textDialog = images.shadowRoot.querySelector('.text-dialog');
      expect(textDialog).to.exist;

      images.openTextDialog(0);
      await textDialog.updateComplete;

      const panel = textDialog.shadowRoot.querySelector('[part~="panel"]');
      expect(panel).to.exist;

      const frameRect = hostFrame.getBoundingClientRect();
      const textRect = panel.getBoundingClientRect();

      expect(textRect.width).to.be.at.most(frameRect.width);
      expect(textRect.height).to.be.at.most(frameRect.height);
      expect(textRect.left).to.be.at.least(frameRect.left - 1);
      expect(textRect.right).to.be.at.most(frameRect.right + 1);

      images.closeTextDialog();
    });
  });

  describe('4. Strict Scoping of Toasts & 5-Second Undo Toast', () => {
    it('scopes notifications and undo toast inside the host container boundary', async () => {
      hostFrame = createHostFrame(360, 640);
      setContainer(hostFrame);

      let undoCalled = false;
      const alert = await notify.undo('Document page deleted', () => {
        undoCalled = true;
      }, { duration: 5000 });

      expect(alert).to.exist;
      expect(alert.duration).to.equal(5000);

      const SlAlert = customElements.get('sl-alert');
      const stack = SlAlert.toastStack;
      expect(stack).to.exist;
      expect(stack.parentElement).to.equal(hostFrame);
      expect(stack.style.position).to.equal('absolute');

      const frameRect = hostFrame.getBoundingClientRect();
      const alertRect = alert.getBoundingClientRect();

      expect(alertRect.left).to.be.at.least(frameRect.left - 1);
      expect(alertRect.right).to.be.at.most(frameRect.right + 1);
      expect(alertRect.top).to.be.at.least(frameRect.top - 1);
      expect(alertRect.bottom).to.be.at.most(frameRect.bottom + 1);

      // Trigger undo action button
      const undoBtn = alert.querySelector('sl-button');
      expect(undoBtn).to.exist;
      undoBtn.click();
      expect(undoCalled).to.be.true;
    });
  });

  describe('5. Carousel Scoping', () => {
    it('scopes copio-carousel strictly inside host container without viewport leakage', async () => {
      hostFrame = createHostFrame(360, 640);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      // Seed a document and open carousel
      const docId = 'doc-carousel-1';
      store.setRow('docs', docId, {
        name: 'Carousel Test Doc',
        pages: JSON.stringify([
          { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
        ]),
      });
      await app.updateComplete;

      const carousel = app.querySelector('copio-carousel');
      carousel.docId = docId;
      carousel.docName = 'Carousel Test Doc';
      carousel.images = [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
      ];
      app.showCarousel = true;
      await app.updateComplete;

      expect(app.showCarousel).to.be.true;
      expect(carousel).to.exist;

      const frameRect = hostFrame.getBoundingClientRect();
      const carouselRect = carousel.getBoundingClientRect();

      expect(carouselRect.width).to.be.at.most(frameRect.width + 1);
      expect(carouselRect.height).to.be.at.most(frameRect.height + 1);
      expect(carouselRect.left).to.be.at.least(frameRect.left - 1);
      expect(carouselRect.right).to.be.at.most(frameRect.right + 1);
      expect(carouselRect.top).to.be.at.least(frameRect.top - 1);
      expect(carouselRect.bottom).to.be.at.most(frameRect.bottom + 1);
    });
  });

  describe('6. Interactive Touch Target Invariants (>= 44px)', () => {
    it('verifies primary buttons and icon buttons maintain >= 44px hit dimensions', async () => {
      hostFrame = createHostFrame(360, 640);
      app = document.createElement('copio-app');
      hostFrame.appendChild(app);
      await app.updateComplete;

      const fabBtn = app.querySelector('.dialog-add-edit-btn');
      expect(fabBtn).to.exist;
      const fabRect = fabBtn.getBoundingClientRect();
      expect(fabRect.width).to.be.at.least(44);
      expect(fabRect.height).to.be.at.least(44);

      const header = app.querySelector('copio-header');
      expect(header).to.exist;
      await header.updateComplete;
      const menuBtn = header.shadowRoot.querySelector('sl-icon-button[name="list"]');
      expect(menuBtn).to.exist;
      await menuBtn.updateComplete;
      const menuRect = menuBtn.getBoundingClientRect();
      expect(menuRect.width).to.be.at.least(44);
      expect(menuRect.height).to.be.at.least(44);
    });
  });
});
