import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { recognizeDocumentPages, recognizeImageText } from '../js/services/ocr-service.js';

describe('OCR Service & Dialog (CPO-021)', () => {
  describe('ocr-service: cancellation and batch processing', () => {
    it('returns empty result cleanly for document with no image pages', async () => {
      const result = await recognizeDocumentPages([]);
      expect(result.empty).to.be.true;
      expect(result.combinedText).to.equal('');
      expect(result.averageConfidence).to.equal(0);
      expect(result.pagesResults).to.be.an('array').that.is.empty;
    });

    it('filters out markdown pages when determining image pages', async () => {
      const pages = [
        { id: 'm1', type: 'markdown', content: '# Meeting Notes' },
        { id: 'm2', type: 'markdown', content: 'Second Note' },
      ];
      const result = await recognizeDocumentPages(pages);
      expect(result.empty).to.be.true;
      expect(result.combinedText).to.equal('');
    });

    it('aborts immediately when abortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const samplePages = [
        { id: 'p1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }
      ];

      try {
        await recognizeDocumentPages(samplePages, { abortSignal: controller.signal });
        expect.fail('Should have thrown AbortError');
      } catch (err) {
        expect(err.name).to.equal('AbortError');
      }
    });

    it('recognizeImageText respects already-aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      try {
        await recognizeImageText('data:image/png;base64,test', { abortSignal: controller.signal });
        expect.fail('Should have thrown AbortError');
      } catch (err) {
        expect(err.name).to.equal('AbortError');
      }
    });
  });

  describe('copio-doc-ocr-dialog: UI and context separation', () => {
    let dialog;

    beforeEach(async () => {
      dialog = document.createElement('copio-doc-ocr-dialog');
      document.body.appendChild(dialog);
      await dialog.updateComplete;
    });

    afterEach(() => {
      dialog?.close();
      dialog?.remove();
    });

    it('clearly distinguishes full document context in dialog label', async () => {
      // Mock startOcr to avoid downloading Tesseract in test
      dialog.startOcr = () => {};

      dialog.open('doc-1', 'Contract Agreement', [
        { id: 'p1', src: 'data:image/png;base64,abc' },
        { id: 'p2', src: 'data:image/png;base64,def' },
      ]);
      await dialog.updateComplete;

      const slDialog = dialog.querySelector('sl-dialog');
      expect(slDialog).to.exist;
      expect(slDialog.getAttribute('label')).to.equal('Extract All Text — Contract Agreement');
    });

    it('clearly distinguishes single page context in dialog label', async () => {
      dialog.startOcr = () => {};

      dialog.openPage('doc-1', 'Invoice', { id: 'p2', src: 'data:image/png;base64,def' }, 1);
      await dialog.updateComplete;

      const slDialog = dialog.querySelector('sl-dialog');
      expect(slDialog).to.exist;
      expect(slDialog.getAttribute('label')).to.equal('Extract Text — Invoice (Page 2)');
    });

    it('handles documents with 0 image pages gracefully without alerts', async () => {
      dialog.open('doc-empty', 'Empty Doc', [
        { id: 'm1', type: 'markdown', content: 'note only' }
      ]);
      await dialog.updateComplete;

      expect(dialog.step).to.equal('empty');
      const text = dialog.textContent;
      expect(text).to.include('This document does not contain any image pages');
    });

    it('renders the complete output action panel when step is done', async () => {
      dialog.docId = 'doc-test';
      dialog.docName = 'Test Document';
      dialog.isOpen = true;
      dialog.step = 'done';
      dialog.resultText = 'Recognized line of text from test page';
      dialog.confidence = 88;
      await dialog.updateComplete;

      // Verify language select exists
      const langSelect = dialog.querySelector('sl-select');
      expect(langSelect).to.exist;

      // Verify confidence badge exists and displays 88%
      const badge = dialog.querySelector('sl-badge');
      expect(badge).to.exist;
      expect(badge.textContent).to.include('88%');

      // Verify textarea exists with extracted text
      const textarea = dialog.querySelector('sl-textarea');
      expect(textarea).to.exist;
      expect(textarea.value).to.equal('Recognized line of text from test page');

      // Verify all actions exist: Close, Copy, Download .txt, Download .md, Save as Note
      const buttons = Array.from(dialog.querySelectorAll('sl-button[slot="footer"]'));
      const buttonLabels = buttons.map((b) => b.textContent.trim());

      expect(buttonLabels.some((l) => l.includes('Close'))).to.be.true;
      expect(buttonLabels.some((l) => l.includes('Copy All'))).to.be.true;
      expect(buttonLabels.some((l) => l.includes('Download .txt'))).to.be.true;
      expect(buttonLabels.some((l) => l.includes('Download .md'))).to.be.true;
      expect(buttonLabels.some((l) => l.includes('Save as Note'))).to.be.true;
    });

    it('renders Cancel button and aborts on cancel() during processing', async () => {
      dialog.docId = 'doc-test';
      dialog.docName = 'Test Document';
      dialog.isOpen = true;
      dialog.step = 'processing';
      dialog.statusMessage = 'Recognizing page 1 of 5...';
      dialog.progress = 20;
      await dialog.updateComplete;

      const cancelButton = Array.from(dialog.querySelectorAll('sl-button[slot="footer"]')).find(
        (b) => b.textContent.includes('Cancel')
      );
      expect(cancelButton).to.exist;

      // Call cancel
      dialog.cancel();
      expect(dialog.isOpen).to.be.false;
    });
  });

  describe('copio-carousel: single-page OCR entry point', () => {
    let carousel;

    beforeEach(async () => {
      carousel = document.createElement('copio-carousel');
      carousel.images = [
        { id: 'p1', src: 'data:image/png;base64,page1' },
        { id: 'm1', type: 'markdown', content: 'note' },
      ];
      document.body.appendChild(carousel);
      await carousel.updateComplete;
    });

    afterEach(() => {
      carousel?.remove();
    });

    it('displays Extract Text button on image slide and dispatches copio:ocr-page', (done) => {
      const ocrBtn = carousel.shadowRoot.querySelector('.ocr-btn');
      expect(ocrBtn).to.exist;
      expect(ocrBtn.textContent).to.include('Extract Text');

      carousel.addEventListener('copio:ocr-page', (e) => {
        expect(e.detail.page.id).to.equal('p1');
        expect(e.detail.pageIndex).to.equal(0);
        done();
      });

      ocrBtn.click();
    });

    it('hides Extract Text button when active slide is markdown', async () => {
      carousel.activeSlideIndex = 1;
      await carousel.updateComplete;

      const ocrBtn = carousel.shadowRoot.querySelector('.ocr-btn');
      expect(ocrBtn).to.not.exist;
    });
  });
});
