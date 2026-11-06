import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import '../sdk/scanner.js';
import notify, { setContainer, clear } from '../js/services/notify.js';

describe('Constrained-Container Layout Pass (CPO-024)', () => {
  let hostFrame;
  let scanner;

  const SIZES = [
    { name: '360x640 Compact Modal', width: 360, height: 640, breakpoint: 'compact' },
    { name: '480x800 Sidebar Drawer', width: 480, height: 800, breakpoint: 'sidebar' },
    { name: '400x800 Narrow Drawer', width: 400, height: 800, breakpoint: 'compact' },
    { name: '800x500 Wide Embed', width: 800, height: 500, breakpoint: 'full' },
    { name: '100% Full View', width: 1024, height: 768, breakpoint: 'full' },
  ];

  beforeEach(() => {
    clear();
    setContainer(null);
  });

  afterEach(() => {
    clear();
    setContainer(null);
    if (scanner) scanner.remove();
    if (hostFrame) hostFrame.remove();
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

    for (const size of SIZES) {
      it(`renders copio-scanner at ${size.name} (${size.width}×${size.height}) with zero horizontal overflow`, async () => {
        hostFrame = createHostFrame(size.width, size.height);
        scanner = document.createElement('copio-scanner');
        hostFrame.appendChild(scanner);

        const frameRect = hostFrame.getBoundingClientRect();
        const scannerRect = scanner.getBoundingClientRect();

        expect(scannerRect.width).to.be.at.most(frameRect.width + 1);
        expect(scannerRect.height).to.be.at.most(frameRect.height + 1);
        expect(hostFrame.scrollWidth).to.be.at.most(hostFrame.clientWidth + 1);
      });
    }
  });

  describe('2. Strict Scoping of Dialogs to Host Element', () => {
    it('scopes copio-doc-ocr-dialog inside 480x800 container without overflowing', async () => {
      hostFrame = createHostFrame(480, 800);
      const ocrDialog = document.createElement('copio-doc-ocr-dialog');
      hostFrame.appendChild(ocrDialog);

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
      ocrDialog.remove();
    });

    it('scopes copio-sync-dialog inside 400x800 container', async () => {
      hostFrame = createHostFrame(400, 800);
      const syncDialog = document.createElement('copio-sync-dialog');
      syncDialog.syncState = {
        mode: 'host',
        step: 'awaiting-peer',
        peerId: 'peer-test-123',
        errorMessage: null,
      };
      hostFrame.appendChild(syncDialog);
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

      syncDialog.closeSyncDialog();
      syncDialog.remove();
    });
  });

  describe('3. Strict Scoping of Toasts & Undo Toast', () => {
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

  describe('4. Interactive Touch Target Invariants (>= 44px)', () => {
    it('verifies shutter button maintains >= 44px hit dimensions', async () => {
      hostFrame = createHostFrame(360, 640);
      scanner = document.createElement('copio-scanner');
      hostFrame.appendChild(scanner);

      const shutterBtn = scanner.shadowRoot.querySelector('#btn-shutter');
      expect(shutterBtn).to.exist;
      const shutterRect = shutterBtn.getBoundingClientRect();
      expect(shutterRect.width).to.be.at.least(44);
      expect(shutterRect.height).to.be.at.least(44);
    });
  });
});
