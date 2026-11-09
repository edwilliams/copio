// SPDX-License-Identifier: AGPL-3.0
import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import {
  CopioHandoff,
  HandoffSession,
  LoopbackTransport,
  COPIO_EVENTS,
} from '../sdk/handoff.js';

function wait(ms = 20) {
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
  ctx.fillRect(20, 20, width - 40, 20);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

describe('CPO-091: <copio-handoff> Desktop Web Component', () => {
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'handoff-test-fixture';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer.remove();
  });

  describe('Initialization & Custom Element Registration', () => {
    it('is registered in customElements and instantiable via document.createElement', () => {
      const el = document.createElement('copio-handoff');
      expect(el).to.be.an.instanceOf(CopioHandoff);
      expect(el.shadowRoot).to.exist;
    });

    it('defaults to waiting state and reflects attributes', () => {
      const el = document.createElement('copio-handoff');
      fixtureContainer.appendChild(el);

      expect(el.state).to.equal('waiting');
      expect(el.mode).to.equal('batch');
      expect(el.theme).to.equal('dark');
      expect(el.ttlMs).to.equal(600000);
      expect(el.pages).to.deep.equal([]);
    });

    it('supports custom attribute values for mode, theme, and ttl', () => {
      const el = document.createElement('copio-handoff');
      el.setAttribute('mode', 'single');
      el.setAttribute('theme', 'light');
      el.setAttribute('ttl', '300000');
      el.setAttribute('doc-id', 'doc_custom_42');
      fixtureContainer.appendChild(el);

      expect(el.mode).to.equal('single');
      expect(el.theme).to.equal('light');
      expect(el.ttlMs).to.equal(300000);
      expect(el.docId).to.equal('doc_custom_42');
    });
  });

  describe('5 UI States Rendering & Container Sizes', () => {
    const containerSizes = [
      { name: 'compact (360x640)', width: '360px', height: '640px' },
      { name: 'tablet (480x800)', width: '480px', height: '800px' },
      { name: 'desktop (100%)', width: '100%', height: '100%' },
    ];

    containerSizes.forEach(({ name, width, height }) => {
      it(`renders all 5 states cleanly in container size: ${name}`, async () => {
        fixtureContainer.style.width = width;
        fixtureContainer.style.height = height;

        const el = document.createElement('copio-handoff');
        fixtureContainer.appendChild(el);
        await wait(30);

        // State 1: waiting
        expect(el.state).to.equal('waiting');
        const qrBox = el.shadowRoot.querySelector('.copio-handoff-qr-box');
        const uploadBtn = el.shadowRoot.querySelector('.copio-handoff-upload-btn');
        const countdown = el.shadowRoot.querySelector('.copio-handoff-countdown');
        expect(qrBox).to.exist;
        expect(uploadBtn).to.exist;
        expect(countdown).to.exist;

        // State 2: connected
        el.state = 'connected';
        await wait(10);
        expect(el.shadowRoot.querySelector('.copio-handoff-status-pill')).to.exist;
        expect(el.shadowRoot.querySelector('.copio-handoff-badge')).to.exist;

        // State 3: receiving
        el.state = 'receiving';
        await wait(10);
        expect(el.shadowRoot.querySelector('.copio-handoff-progress-bar')).to.exist;

        // State 4: complete
        el.state = 'complete';
        await wait(10);
        expect(el.shadowRoot.querySelector('.copio-handoff-success-icon')).to.exist;
        expect(el.shadowRoot.querySelector('.copio-handoff-reset-btn')).to.exist;

        // State 5: expired
        el.state = 'expired';
        await wait(10);
        expect(el.shadowRoot.querySelector('.copio-handoff-retry-btn')).to.exist;

        // State 5: error
        el.state = 'error';
        await wait(10);
        expect(el.shadowRoot.querySelector('.copio-handoff-retry-btn')).to.exist;
      });
    });
  });

  describe('End-to-End Session Streaming & Event Lifecycle', () => {
    it('connects to headless sender, updates progress and thumbnails, and fires all lifecycle events', async () => {
      const [hostTransport, senderTransport] = LoopbackTransport.createPair();

      const hostSession = new HandoffSession({
        role: 'host',
        transport: hostTransport,
        chunkSize: 64 * 1024,
      });

      const senderSession = new HandoffSession({
        role: 'sender',
        transport: senderTransport,
        chunkSize: 64 * 1024,
      });

      const el = document.createElement('copio-handoff');
      el.docId = 'test_doc_handoff_101';
      fixtureContainer.appendChild(el);

      // Start host session and attach to component
      const { token } = await hostSession.startHost({ baseUrl: 'https://copio.netlify.app/scan' });
      el.attachSession(hostSession, token);

      expect(el.state).to.equal('waiting');

      // Track events fired on component
      const events = {
        connected: null,
        pageAdded: [],
        complete: null,
      };

      el.addEventListener(COPIO_EVENTS.HANDOFF_CONNECTED, (e) => {
        events.connected = e.detail;
      });
      el.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => {
        events.pageAdded.push(e.detail);
      });
      el.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        events.complete = e.detail;
      });

      // 1. Connect sender
      await senderSession.startSender(token);
      await wait(50);

      expect(events.connected).to.exist;
      expect(events.connected.sessionId).to.equal(token.sessionId);
      expect(el.state).to.equal('connected');

      // 2. Stream Page 1
      const blob1 = await createDummyImageBlob('#059669', 100, 140);
      await senderSession.sendPage({
        id: 'page_hand_01',
        pageIndex: 0,
        mimeType: 'image/png',
        blob: blob1,
        metadata: { width: 100, height: 140 },
      });
      await wait(50);

      expect(events.pageAdded.length).to.equal(1);
      expect(events.pageAdded[0].page.id).to.equal('page_hand_01');
      expect(events.pageAdded[0].pageNumber).to.equal(1);
      expect(events.pageAdded[0].source).to.equal('handoff');
      expect(events.pageAdded[0].docId).to.equal('test_doc_handoff_101');
      expect(el.pages.length).to.equal(1);

      // 3. Stream Page 2 (multi-page batch)
      const blob2 = await createDummyImageBlob('#dc2626', 100, 140);
      await senderSession.sendPage({
        id: 'page_hand_02',
        pageIndex: 1,
        mimeType: 'image/png',
        blob: blob2,
        metadata: { width: 100, height: 140 },
      });
      await wait(50);

      expect(events.pageAdded.length).to.equal(2);
      expect(events.pageAdded[1].page.id).to.equal('page_hand_02');
      expect(events.pageAdded[1].pageNumber).to.equal(2);
      expect(el.pages.length).to.equal(2);

      // Verify thumbnails rendered in DOM
      const thumbGrid = el.shadowRoot.querySelector('[data-testid="thumbnail-grid"]');
      expect(thumbGrid).to.exist;
      const thumbCards = thumbGrid.querySelectorAll('.copio-handoff-thumb-card');
      expect(thumbCards.length).to.equal(2);

      // 4. Complete session
      await senderSession.complete({
        summary: { mode: 'batch', source: 'mobile_camera' },
      });
      await wait(50);

      expect(el.state).to.equal('complete');
      expect(events.complete).to.exist;
      expect(events.complete.docId).to.equal('test_doc_handoff_101');
      expect(events.complete.pageCount).to.equal(2);
      expect(events.complete.pages.length).to.equal(2);
      expect(events.complete.summary.source).to.equal('mobile_camera');

      // Cleanup
      hostSession.close();
      senderSession.close();
    });
  });

  describe('Local File Upload Fallback', () => {
    it('triggers file selection and emits copio:page-added and copio:scan-complete', async () => {
      const el = document.createElement('copio-handoff');
      el.docId = 'doc_upload_fallback_test';
      fixtureContainer.appendChild(el);
      await wait(30);

      const events = {
        pageAdded: [],
        complete: null,
      };

      el.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => {
        events.pageAdded.push(e.detail);
      });
      el.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        events.complete = e.detail;
      });

      const uploadBtn = el.shadowRoot.querySelector('.copio-handoff-upload-btn');
      const fileInput = el.shadowRoot.querySelector('.copio-handoff-file-input');
      expect(uploadBtn).to.exist;
      expect(fileInput).to.exist;

      // Mock user selecting files
      const blob = await createDummyImageBlob('#6366f1', 80, 100);
      const testFile = new File([blob], 'receipt.png', { type: 'image/png' });

      // Simulate input change
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        configurable: true,
      });

      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(30);

      expect(events.pageAdded.length).to.equal(1);
      expect(events.pageAdded[0].page.label).to.equal('receipt.png');
      expect(events.pageAdded[0].source).to.equal('file');
      expect(events.pageAdded[0].docId).to.equal('doc_upload_fallback_test');

      expect(events.complete).to.exist;
      expect(events.complete.pageCount).to.equal(1);
      expect(events.complete.source).to.equal('file');
      expect(el.state).to.equal('complete');
    });
  });

  describe('Recovery & Refresh Actions', () => {
    it('generates a new session and resets to waiting when retry button is clicked in expired state', async () => {
      const el = document.createElement('copio-handoff');
      fixtureContainer.appendChild(el);
      await wait(30);

      const initialToken = el.token;

      // Set to expired
      el.state = 'expired';
      await wait(10);

      const retryBtn = el.shadowRoot.querySelector('.copio-handoff-retry-btn');
      expect(retryBtn).to.exist;

      retryBtn.click();
      await wait(50);

      expect(el.state).to.equal('waiting');
      expect(el.token).to.exist;
      if (initialToken) {
        expect(el.token.sessionId).to.not.equal(initialToken.sessionId);
      }
    });

    it('clears pages and returns to waiting state when clear() is called', async () => {
      const el = document.createElement('copio-handoff');
      fixtureContainer.appendChild(el);
      await wait(30);

      // Add dummy file
      const blob = await createDummyImageBlob();
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const fileInput = el.shadowRoot.querySelector('.copio-handoff-file-input');
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change'));
      await wait(30);

      expect(el.pages.length).to.equal(1);
      expect(el.state).to.equal('complete');

      await el.clear();
      expect(el.pages.length).to.equal(0);
      expect(el.state).to.equal('waiting');
    });
  });
});
