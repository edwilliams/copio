import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import {
  CopioEngine,
  COPIO_EVENTS,
  NullOcrAdapter,
  NullPdfAdapter,
} from '../sdk/index.js';
import '../js/routes/doc/copio-carousel.js';
import '../js/routes/home/copio-row.js';
import '../js/routes/doc/copio-images.js';
import '../js/routes/ocr/copio-doc-ocr-dialog.js';
import { notify } from '../js/services/notify.js';
import { getOcrWorker } from '../js/services/ocr-service.js';
import { exportDocumentAsPdf } from '../js/services/export-utils.js';

describe('Heavy Module Opt-In & Lazy UI (CPO-042 & CPO-043)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container?.remove();
    notify.clear();
  });

  describe('CPO-042: Developer Opt-In for Heavy Modules (OCR & PDF)', () => {
    it('initializes with ocr=true and pdf=true by default', () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      expect(scanner.ocrEnabled).to.be.true;
      expect(scanner.pdf).to.be.true;
      expect(scanner.hasFeature('ocr')).to.be.true;
      expect(scanner.exportFormats).to.include('pdf');
    });

    it('respects ocr="false" and pdf="false" HTML attributes on initialization', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('ocr', 'false');
      scanner.setAttribute('pdf', 'false');
      container.appendChild(scanner);

      expect(scanner.ocrEnabled).to.be.false;
      expect(scanner.pdf).to.be.false;
      expect(scanner.hasFeature('ocr')).to.be.false;
      expect(scanner.exportFormats).to.not.include('pdf');
    });

    it('dynamically toggles ocr and pdf via properties and attributes', () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      // Disable via properties
      scanner.ocrEnabled = false;
      scanner.pdf = false;
      expect(scanner.ocrEnabled).to.be.false;
      expect(scanner.pdf).to.be.false;
      expect(scanner.hasFeature('ocr')).to.be.false;
      expect(scanner.exportFormats).to.not.include('pdf');
      expect(scanner.getAttribute('ocr')).to.equal('false');
      expect(scanner.getAttribute('pdf')).to.equal('false');

      // Re-enable via attributes
      scanner.setAttribute('ocr', 'true');
      scanner.setAttribute('pdf', 'true');
      expect(scanner.ocrEnabled).to.be.true;
      expect(scanner.pdf).to.be.true;
      expect(scanner.hasFeature('ocr')).to.be.true;
      expect(scanner.exportFormats).to.include('pdf');
    });

    it('headless CopioEngine supports ocr and pdf opt-in options', () => {
      const engineDisabled = new CopioEngine({ ocr: false, pdf: false });
      expect(engineDisabled.ocr).to.be.false;
      expect(engineDisabled.pdf).to.be.false;
      expect(engineDisabled.hasFeature('ocr')).to.be.false;
      expect(engineDisabled.exportFormats).to.not.include('pdf');

      const engineEnabled = new CopioEngine({ ocr: true, pdf: true });
      expect(engineEnabled.ocr).to.be.true;
      expect(engineEnabled.pdf).to.be.true;
      expect(engineEnabled.hasFeature('ocr')).to.be.true;
      expect(engineEnabled.exportFormats).to.include('pdf');
    });

    it('zero network requests: disabled scanner blocks OCR and PDF with FEATURE_DISABLED and does not invoke loaders', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.ocrEnabled = false;
      scanner.pdf = false;
      container.appendChild(scanner);

      let errorEvent = null;
      scanner.addEventListener(COPIO_EVENTS.ERROR, (e) => {
        errorEvent = e.detail;
      });

      // Test OCR execution
      let ocrError = null;
      try {
        await scanner.ocr();
      } catch (err) {
        ocrError = err;
      }
      expect(ocrError).to.exist;
      expect(ocrError.code).to.equal('FEATURE_DISABLED');
      expect(errorEvent).to.exist;
      expect(errorEvent.code).to.equal('FEATURE_DISABLED');

      // Test PDF export execution
      errorEvent = null;
      let pdfError = null;
      try {
        await scanner.exportPdf();
      } catch (err) {
        pdfError = err;
      }
      expect(pdfError).to.exist;
      expect(pdfError.code).to.equal('FEATURE_DISABLED');
      expect(errorEvent).to.exist;
      expect(errorEvent.code).to.equal('FEATURE_DISABLED');
    });

    it('NullOcrAdapter and NullPdfAdapter throw FEATURE_DISABLED and produce zero side-effects', async () => {
      const nullOcr = new NullOcrAdapter();
      expect(await nullOcr.getOcrWorker()).to.be.null;

      try {
        await nullOcr.recognizeImageText('data:image/png;base64,...');
        expect.fail('Should throw');
      } catch (err) {
        expect(err.code).to.equal('FEATURE_DISABLED');
      }

      try {
        await nullOcr.recognizeDocumentPages([{ id: '1', src: 'data:image/png;base64,...' }]);
        expect.fail('Should throw');
      } catch (err) {
        expect(err.code).to.equal('FEATURE_DISABLED');
      }

      const nullPdf = new NullPdfAdapter();
      expect(await nullPdf.renderPdfPagesToDataUrls(new ArrayBuffer(0))).to.deep.equal([]);

      try {
        await nullPdf.exportDocumentAsPdf('test', []);
        expect.fail('Should throw');
      } catch (err) {
        expect(err.code).to.equal('FEATURE_DISABLED');
      }
    });

    it('CopioCarousel hides "Extract Text" and "Download as PDF" when opted out', async () => {
      const carousel = document.createElement('copio-carousel');
      carousel.images = [{ id: '1', src: 'data:image/png;base64,sample' }];
      carousel.ocr = false;
      carousel.pdf = false;
      container.appendChild(carousel);
      await carousel.updateComplete;

      // Extract Text button should not exist
      const ocrBtn = carousel.shadowRoot.querySelector('.ocr-btn');
      expect(ocrBtn).to.be.null;

      // PDF menu item should not exist
      const pdfMenuItem = carousel.shadowRoot.querySelector('sl-menu-item[value="pdf"]');
      expect(pdfMenuItem).to.be.null;

      // ZIP export should still be available
      const zipMenuItem = carousel.shadowRoot.querySelector('sl-menu-item[value="images"]');
      expect(zipMenuItem).to.exist;

      // When re-enabled, buttons appear
      carousel.ocr = true;
      carousel.pdf = true;
      await carousel.updateComplete;

      expect(carousel.shadowRoot.querySelector('.ocr-btn')).to.exist;
      expect(carousel.shadowRoot.querySelector('sl-menu-item[value="pdf"]')).to.exist;
    });

    it('CopioRow hides "Extract All Text (OCR)" and "Download as PDF" when opted out', async () => {
      const row = document.createElement('copio-row');
      row.name = 'Invoice';
      row.pages = [{ id: '1', src: 'data:image/png;base64,sample' }];
      row.ocr = false;
      row.pdf = false;
      container.appendChild(row);
      await row.updateComplete;

      const ocrItem = row.shadowRoot.querySelector('sl-menu-item[value="extract-ocr"]');
      expect(ocrItem).to.be.null;

      const pdfItem = row.shadowRoot.querySelector('sl-menu-item[value="download"]');
      expect(pdfItem).to.be.null;

      // Images export should still exist
      const imgItem = row.shadowRoot.querySelector('sl-menu-item[value="download-images"]');
      expect(imgItem).to.exist;

      // When re-enabled, items appear
      row.ocr = true;
      row.pdf = true;
      await row.updateComplete;

      expect(row.shadowRoot.querySelector('sl-menu-item[value="extract-ocr"]')).to.exist;
      expect(row.shadowRoot.querySelector('sl-menu-item[value="download"]')).to.exist;
    });

    it('CopioImages hides "Extract Text" menu item when ocr is false', () => {
      const imagesView = document.createElement('copio-images');
      imagesView.ocr = false;
      container.appendChild(imagesView);
      imagesView.images = [
        { id: '1', src: 'data:image/png;base64,sample' },
      ];

      const ocrMenuItem = imagesView.shadowRoot.querySelector('sl-menu-item[value="ocr"]');
      expect(ocrMenuItem).to.be.null;

      imagesView.ocr = true;
      expect(imagesView.shadowRoot.querySelector('sl-menu-item[value="ocr"]')).to.exist;
    });
  });

  describe('CPO-043: Lazy-Load UI for Heavy Modules', () => {
    let originalWindowTesseractDesc;
    let originalWindowPdfDocDesc;

    beforeEach(() => {
      originalWindowTesseractDesc = Object.getOwnPropertyDescriptor(window, 'Tesseract');
      originalWindowPdfDocDesc = Object.getOwnPropertyDescriptor(window, 'PDFDocument');
    });

    afterEach(() => {
      if (originalWindowTesseractDesc) {
        Object.defineProperty(window, 'Tesseract', originalWindowTesseractDesc);
      } else {
        delete window.Tesseract;
      }

      if (originalWindowPdfDocDesc) {
        Object.defineProperty(window, 'PDFDocument', originalWindowPdfDocDesc);
      } else {
        delete window.PDFDocument;
      }
    });

    it('shows user-facing download progress when Tesseract is first loaded', async () => {
      let getterCount = 0;
      const mockTesseract = {
        createWorker: async () => ({
          terminate: async () => {},
        }),
      };

      Object.defineProperty(window, 'Tesseract', {
        configurable: true,
        get() {
          getterCount++;
          if (getterCount === 1) return undefined;
          return mockTesseract;
        },
      });

      let progressReported = null;
      const onProgress = (p) => {
        if (p.status === 'downloading-engine') {
          progressReported = p;
        }
      };

      await getOcrWorker('eng', onProgress);

      expect(progressReported).to.not.be.null;
      expect(progressReported.message).to.include('Downloading OCR engine');
      expect(progressReported.status).to.equal('downloading-engine');
    });

    it('CopioDocOcrDialog displays downloading message when Tesseract is not cached yet', async () => {
      delete window.Tesseract;
      const dialog = document.createElement('copio-doc-ocr-dialog');
      container.appendChild(dialog);

      // Stub startOcr so it does not actually run
      dialog.startOcr = () => {};

      dialog.open('doc-1', 'Invoice', [{ id: '1', src: 'data:image/png;base64,sample' }]);
      await dialog.updateComplete;

      expect(dialog.statusMessage).to.equal('Downloading OCR engine (12MB)...');
      dialog.close();
    });

    it('CopioDocOcrDialog skips download message when Tesseract is already cached', async () => {
      window.Tesseract = {};
      const dialog = document.createElement('copio-doc-ocr-dialog');
      container.appendChild(dialog);

      dialog.startOcr = () => {};

      dialog.open('doc-1', 'Invoice', [{ id: '1', src: 'data:image/png;base64,sample' }]);
      await dialog.updateComplete;

      expect(dialog.statusMessage).to.equal('Starting OCR engine...');
      dialog.close();
    });

    it('exportDocumentAsPdf reports download progress on first invocation when PDFDocument is missing', async () => {
      let getterCount = 0;
      const MockPDFDocument = class {
        constructor() {
          this.page = { width: 595, height: 841, margins: { bottom: 40 } };
        }
        on(event, cb) {
          if (event === 'end') setTimeout(cb, 5);
          return this;
        }
        addPage() { return this; }
        image() { return this; }
        end() { return this; }
      };

      Object.defineProperty(window, 'PDFDocument', {
        configurable: true,
        get() {
          getterCount++;
          if (getterCount === 1) return undefined;
          return MockPDFDocument;
        },
      });

      let progressReported = null;
      const progressCallback = (done, total, message) => {
        if (message && message.includes('Downloading PDF engine')) {
          progressReported = message;
        }
      };

      await exportDocumentAsPdf('Test Doc', [{ id: '1', src: 'data:image/png;base64,sample' }], {
        download: false,
        showProgress: false,
        onProgress: progressCallback,
      });

      expect(progressReported).to.include('Downloading PDF engine');
    });
  });
});
