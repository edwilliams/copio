// SPDX-License-Identifier: AGPL-3.0
import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import { LoopbackTransport } from '../sdk/index.js';

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
  ctx.fillRect(15, 15, width - 30, 20);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg'));
}

describe('CPO-094: <copio-scanner> Mobile Handoff Sender Mode & Reconnection', function () {
  this.timeout(15000);

  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'handoff-sender-test-fixture';
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

  describe('Booting into Mobile Handoff Sender Mode', () => {
    it('boots into handoff mode and pairs automatically via handoff URL attribute', async () => {
      // 1. Create desktop component (registers host in loopback registry)
      const desktopEl = document.createElement('copio-handoff');
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      expect(desktopEl.url).to.exist;

      // 2. Create mobile scanner with handoff URL attribute
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(scanner);
      await wait(100);

      expect(scanner.isHandoff).to.be.true;
      expect(scanner.handoffState).to.equal('connected');
      expect(desktopEl.state).to.equal('connected');

      // Check handoff pill in shadow DOM
      const pill = scanner.shadowRoot.getElementById('handoff-pill');
      expect(pill).to.exist;
      expect(pill.style.display).to.equal('inline-flex');
      const statusText = scanner.shadowRoot.getElementById('handoff-status-text');
      expect(statusText.textContent).to.include('Paired with computer');
    });

    it('boots into handoff mode when URL hash contains #handoff=...', async () => {
      const desktopEl = document.createElement('copio-handoff');
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      // Simulate phone scanning QR code by navigating to hash
      window.location.hash = desktopEl.url.slice(desktopEl.url.indexOf('#'));

      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);
      await wait(100);

      expect(scanner.isHandoff).to.be.true;
      expect(scanner.handoffState).to.equal('connected');
      expect(desktopEl.state).to.equal('connected');
    });
  });

  describe('End-to-End Scan Streaming: Desktop <copio-handoff> + Mobile <copio-scanner>', () => {
    it('streams single-shot scan to desktop component and shows confirmation screen', async () => {
      // 1. Mount Desktop <copio-handoff>
      const desktopEl = document.createElement('copio-handoff');
      desktopEl.mode = 'single';
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      expect(desktopEl.state).to.equal('waiting');

      // 2. Mount Mobile <copio-scanner>
      const mobileEl = document.createElement('copio-scanner');
      mobileEl.mode = 'single';
      mobileEl.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(mobileEl);
      await wait(100);

      expect(desktopEl.state).to.equal('connected');
      expect(mobileEl.handoffState).to.equal('connected');

      // Track events on desktop
      const desktopPages = [];
      let desktopComplete = null;
      desktopEl.addEventListener('copio:page-added', (e) => desktopPages.push(e.detail));
      desktopEl.addEventListener('copio:scan-complete', (e) => {
        desktopComplete = e.detail;
      });

      // Track events on mobile
      let mobileComplete = null;
      mobileEl.addEventListener('copio:scan-complete', (e) => {
        mobileComplete = e.detail;
      });

      // 3. Capture image on mobile
      const dummyBlob = await createDummyImageBlob('#0284c7', 200, 300);
      const dummyFile = new File([dummyBlob], 'single-receipt.jpg', { type: 'image/jpeg' });
      await mobileEl.addFiles([dummyFile]);
      await wait(50);

      // Verify button label
      const primaryBtn = mobileEl.shadowRoot.getElementById('btn-primary-complete');
      expect(primaryBtn.textContent).to.include('Send to Computer');

      // 4. Complete Scan on mobile
      await mobileEl.completeScan();
      await wait(150);

      // Verify desktop received the page and scan-complete
      expect(desktopPages.length).to.equal(1);
      expect(desktopPages[0].source).to.equal('handoff');
      expect(desktopComplete).to.exist;
      expect(desktopComplete.pageCount).to.equal(1);
      expect(desktopEl.state).to.equal('complete');

      // Verify mobile shows clean confirmation screen (CPO-094)
      const confirmView = mobileEl.shadowRoot.getElementById('handoff-confirm-view');
      expect(confirmView).to.exist;
      expect(confirmView.style.display).to.equal('flex');
      const confirmTitle = mobileEl.shadowRoot.querySelector('.copio-handoff-confirm-title');
      expect(confirmTitle.textContent).to.equal('Sent to your computer');
      const confirmSubtitle = mobileEl.shadowRoot.querySelector('.copio-handoff-confirm-subtitle');
      expect(confirmSubtitle.textContent).to.equal('You can close this tab now.');
      const confirmBadge = mobileEl.shadowRoot.getElementById('handoff-confirm-count');
      expect(confirmBadge.textContent).to.include('1 page transferred');

      expect(mobileComplete).to.exist;
      expect(mobileComplete.pageCount).to.equal(1);

      // Test "Scan More Documents" button resets scanner cleanly
      const scanMoreBtn = mobileEl.shadowRoot.getElementById('btn-handoff-scan-more');
      expect(scanMoreBtn).to.exist;
      scanMoreBtn.click();
      await wait(50);
      expect(confirmView.style.display).to.equal('none');
      expect(mobileEl.stage).to.equal('viewfinder');
    });

    it('streams 2-sided ID card scan (front & back) to desktop component', async () => {
      // 1. Mount Desktop <copio-handoff>
      const desktopEl = document.createElement('copio-handoff');
      desktopEl.aspect = 'card';
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      // 2. Mount Mobile <copio-scanner>
      const mobileEl = document.createElement('copio-scanner');
      mobileEl.aspect = 'card';
      mobileEl.maxPages = 2;
      mobileEl.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(mobileEl);
      await wait(100);

      expect(desktopEl.state).to.equal('connected');
      expect(mobileEl.handoffState).to.equal('connected');

      const desktopPages = [];
      let desktopComplete = null;
      desktopEl.addEventListener('copio:page-added', (e) => desktopPages.push(e.detail));
      desktopEl.addEventListener('copio:scan-complete', (e) => {
        desktopComplete = e.detail;
      });

      // 3. Step 1: Capture Front of ID Card
      const frontBlob = await createDummyImageBlob('#3b82f6', 300, 200);
      const frontFile = new File([frontBlob], 'card-front.jpg', { type: 'image/jpeg' });
      await mobileEl.addFiles([frontFile]);
      await wait(50);

      // In card guided mode, completing step 1 advances to viewfinder for step 2
      await mobileEl.completeScan();
      await wait(50);
      expect(mobileEl.stage).to.equal('viewfinder');

      // 4. Step 2: Capture Back of ID Card
      const backBlob = await createDummyImageBlob('#10b981', 300, 200);
      const backFile = new File([backBlob], 'card-back.jpg', { type: 'image/jpeg' });
      await mobileEl.addFiles([backFile]);
      await wait(50);

      // Verify primary CTA label for 2-sided card
      const primaryBtn = mobileEl.shadowRoot.getElementById('btn-primary-complete');
      expect(primaryBtn.textContent).to.include('Send ID Card to Computer (2 Sides)');

      // 5. Complete Scan
      await mobileEl.completeScan();
      await wait(150);

      // Verify desktop received both sides
      expect(desktopPages.length).to.equal(2);
      expect(desktopComplete).to.exist;
      expect(desktopComplete.pageCount).to.equal(2);

      // Verify mobile confirmation screen displays 2 pages
      const confirmBadge = mobileEl.shadowRoot.getElementById('handoff-confirm-count');
      expect(confirmBadge.textContent).to.include('2 pages transferred');
    });

    it('streams multi-page batch scan to desktop component', async () => {
      // 1. Mount Desktop <copio-handoff>
      const desktopEl = document.createElement('copio-handoff');
      desktopEl.mode = 'batch';
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      // 2. Mount Mobile <copio-scanner>
      const mobileEl = document.createElement('copio-scanner');
      mobileEl.mode = 'batch';
      mobileEl.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(mobileEl);
      await wait(100);

      expect(desktopEl.state).to.equal('connected');
      expect(mobileEl.handoffState).to.equal('connected');

      const desktopPages = [];
      let desktopComplete = null;
      desktopEl.addEventListener('copio:page-added', (e) => desktopPages.push(e.detail));
      desktopEl.addEventListener('copio:scan-complete', (e) => {
        desktopComplete = e.detail;
      });

      // 3. Add 3 pages on mobile
      const p1 = new File([await createDummyImageBlob('#ef4444', 150, 200)], 'p1.jpg', { type: 'image/jpeg' });
      const p2 = new File([await createDummyImageBlob('#f59e0b', 150, 200)], 'p2.jpg', { type: 'image/jpeg' });
      const p3 = new File([await createDummyImageBlob('#8b5cf6', 150, 200)], 'p3.jpg', { type: 'image/jpeg' });
      await mobileEl.addFiles([p1, p2, p3]);
      await wait(50);

      const pages = await mobileEl.getPages();
      expect(pages.length).to.equal(3);

      // 4. Complete Scan
      await mobileEl.completeScan();
      await wait(180);

      // Verify desktop received all 3 pages
      expect(desktopPages.length).to.equal(3);
      expect(desktopComplete).to.exist;
      expect(desktopComplete.pageCount).to.equal(3);

      // Verify mobile confirmation screen
      const confirmBadge = mobileEl.shadowRoot.getElementById('handoff-confirm-count');
      expect(confirmBadge.textContent).to.include('3 pages transferred');
    });
  });

  describe('Reconnection & Channel Interruption Resilience', () => {
    it('recovers and streams successfully when connection is interrupted', async () => {
      const desktopEl = document.createElement('copio-handoff');
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(scanner);
      await wait(100);

      expect(scanner.handoffState).to.equal('connected');

      // 1. Simulate data channel interruption by closing sender transport
      const senderSession = scanner.handoffSession;
      expect(senderSession).to.exist;

      // Access transport and simulate interruption
      const hostTransport = LoopbackTransport.get(desktopEl.token.peerId);
      expect(hostTransport).to.exist;

      hostTransport.interrupt();
      await wait(40);

      expect(scanner.handoffState).to.equal('disconnected');
      const retryBtn = scanner.shadowRoot.getElementById('btn-handoff-retry');
      expect(retryBtn.style.display).to.equal('inline-block');

      // 2. Re-open host transport and reconnect
      hostTransport.reconnect();
      await scanner.reconnectHandoff();
      await wait(80);

      expect(scanner.handoffState).to.equal('connected');
      expect(retryBtn.style.display).to.equal('none');

      // 3. Add and send page after reconnection
      const dummyBlob = await createDummyImageBlob('#10b981', 120, 160);
      await scanner.addFiles([new File([dummyBlob], 'reconnect.jpg', { type: 'image/jpeg' })]);
      await wait(40);

      await scanner.completeScan();
      await wait(120);

      expect(desktopEl.pages.length).to.equal(1);
      expect(scanner.handoffState).to.equal('complete');
    });

    it('handles mobile visibility change when returning from background', async () => {
      const desktopEl = document.createElement('copio-handoff');
      fixtureContainer.appendChild(desktopEl);
      await wait(50);

      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('handoff', desktopEl.url);
      fixtureContainer.appendChild(scanner);
      await wait(100);

      expect(scanner.handoffState).to.equal('connected');

      const hostTransport = LoopbackTransport.get(desktopEl.token.peerId);
      expect(hostTransport).to.exist;

      // Interrupt while backgrounded
      hostTransport.interrupt();
      await wait(30);
      expect(scanner.handoffState).to.equal('disconnected');

      // Reconnect transport and simulate visibility change to visible
      hostTransport.reconnect();
      document.dispatchEvent(new Event('visibilitychange'));
      await wait(100);

      expect(scanner.handoffState).to.equal('connected');
    });
  });
});
