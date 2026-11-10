// SPDX-License-Identifier: AGPL-3.0
import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import {
  LoopbackTransport,
  COPIO_EVENTS,
} from '../sdk/index.js';
import { exportDocumentAsPdf } from '../js/services/export-utils.js';

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDummyImageBlob(color = '#0284c7', width = 120, height = 160) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('NORDIC COFFEE', 15, 30);
  ctx.fillText('$45.08', 15, 50);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg'));
}

describe('CPO-093: Interactive Phone-to-Desktop Handoff Demo in SDK Sandbox', function () {
  this.timeout(20000);

  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'handoff-demo-fixture';
    document.body.appendChild(fixtureContainer);
    LoopbackTransport.clearRegistry();
  });

  afterEach(() => {
    fixtureContainer.remove();
    LoopbackTransport.clearRegistry();
    if (typeof window !== 'undefined' && window.location.hash) {
      window.location.hash = '';
    }
  });

  describe('Desktop <copio-handoff> Peer & Loopback Dual-Bridge', () => {
    it('creates host token and enables local simulated scanner pairing via LoopbackTransport', async () => {
      // 1. Mount Desktop <copio-handoff>
      const desktopEl = document.createElement('copio-handoff');
      desktopEl.mode = 'single';
      desktopEl.aspect = 'receipt';
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      expect(desktopEl.url).to.exist;
      expect(desktopEl.token).to.exist;
      expect(desktopEl.state).to.equal('waiting');

      // Verify peerId is registered in LoopbackTransport registry for same-window simulation
      expect(LoopbackTransport.has(desktopEl.token.peerId)).to.be.true;

      // 2. Mount Simulated Mobile <copio-scanner> (Split View)
      const mobileEl = document.createElement('copio-scanner');
      mobileEl.mode = 'single';
      mobileEl.aspect = 'receipt';
      mobileEl.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(mobileEl);
      await wait(100);

      expect(desktopEl.state).to.equal('connected');
      expect(mobileEl.handoffState).to.equal('connected');

      // 3. Capture image on simulated mobile scanner
      const dummyBlob = await createDummyImageBlob('#10b981', 180, 260);
      const file = new File([dummyBlob], 'receipt-coffee.jpg', { type: 'image/jpeg' });
      await mobileEl.addFiles([file]);
      await wait(50);

      // Verify mobile workbench opened
      expect(mobileEl.stage).to.equal('workbench');

      // Track desktop events
      const desktopPages = [];
      let desktopComplete = null;
      desktopEl.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => desktopPages.push(e.detail));
      desktopEl.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        desktopComplete = e.detail;
      });

      // 4. Complete scan on simulated mobile phone
      await mobileEl.completeScan();
      await wait(180);

      // Verify desktop received the page and completed
      expect(desktopPages.length).to.equal(1);
      expect(desktopPages[0].source).to.equal('handoff');
      expect(desktopComplete).to.exist;
      expect(desktopComplete.pageCount).to.equal(1);
      expect(desktopEl.state).to.equal('complete');

      // Verify mobile confirmation screen
      expect(mobileEl.handoffState).to.equal('complete');
      const confirmBadge = mobileEl.shadowRoot.getElementById('handoff-confirm-count');
      expect(confirmBadge).to.exist;
      expect(confirmBadge.textContent).to.include('1 page transferred');
    });

    it('generates Searchable PDF from received pages upon completion', async () => {
      const desktopEl = document.createElement('copio-handoff');
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      const mobileEl = document.createElement('copio-scanner');
      mobileEl.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(mobileEl);
      await wait(100);

      const dummyBlob = await createDummyImageBlob('#0284c7', 150, 200);
      await mobileEl.addFiles([new File([dummyBlob], 'receipt.jpg', { type: 'image/jpeg' })]);
      await wait(50);

      let completeDetail = null;
      desktopEl.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        completeDetail = e.detail;
      });

      await mobileEl.completeScan();
      await wait(180);

      expect(completeDetail).to.exist;
      expect(completeDetail.pages.length).to.equal(1);

      // Export Searchable PDF
      const pdfBlob = await exportDocumentAsPdf(
        'Expense-1042-Receipt',
        completeDetail.pages,
        {
          searchable: true,
          download: false,
          showProgress: false,
        }
      );

      expect(pdfBlob).to.exist;
      expect(pdfBlob.type).to.equal('application/pdf');
      expect(pdfBlob.size).to.be.greaterThan(500);
    });
  });

  describe('Real Phone QR Scanning Hash Detection', () => {
    it('detects #handoff= hash and initializes mobile scanner sender mode', async () => {
      const desktopEl = document.createElement('copio-handoff');
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      // Simulate real phone scanning the QR code: phone opens URL with #handoff=...
      const qrHash = desktopEl.url.slice(desktopEl.url.indexOf('#'));
      expect(qrHash).to.include('#handoff=');
      window.location.hash = qrHash;

      // When mobile scanner is mounted with hash, it should auto-pair
      const realPhoneScanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(realPhoneScanner);
      await wait(120);

      expect(realPhoneScanner.isHandoff).to.be.true;
      expect(realPhoneScanner.handoffState).to.equal('connected');
      expect(desktopEl.state).to.equal('connected');
    });
  });
});
