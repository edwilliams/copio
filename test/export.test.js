import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import { exportDocumentAsPdf, exportDocumentAsImages } from '../js/services/export-utils.js';
import notify from '../js/services/notify.js';
import { loadJsZip } from '../js/utils/module-loader.js';
import * as pdfjsLib from '../js/lib/pdf.min.mjs';
import { docRepository } from '../js/services/doc-repository.js';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.mjs';
}

function createTestImageDataUrl(width = 30, height = 30, color = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
}

describe('Export Smoke Tests', () => {
  let createdBlobs = [];
  let downloadedFilenames = [];
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalAnchorClick;
  let notifyMessages = [];
  let originalNotifyShow;

  beforeEach(() => {
    createdBlobs = [];
    downloadedFilenames = [];
    notifyMessages = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalAnchorClick = HTMLAnchorElement.prototype.click;
    originalNotifyShow = notify.show;

    URL.createObjectURL = (blob) => {
      createdBlobs.push(blob);
      return originalCreateObjectURL(blob);
    };
    URL.revokeObjectURL = (url) => {
      originalRevokeObjectURL(url);
    };

    HTMLAnchorElement.prototype.click = function () {
      downloadedFilenames.push(this.download);
    };

    notify.show = (msgOrOpts, opts) => {
      const msg = typeof msgOrOpts === 'string' ? msgOrOpts : msgOrOpts?.message;
      if (msg) notifyMessages.push(msg);
      return originalNotifyShow(msgOrOpts, opts);
    };
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
    notify.show = originalNotifyShow;
    notify.clear();
  });

  it('exportDocumentAsPdf produces a valid PDF blob without throwing', async () => {
    const pages = [
      { id: 'p1', src: createTestImageDataUrl(40, 40, '#f97316') },
      { id: 'p2', src: createTestImageDataUrl(40, 40, '#3b82f6') },
    ];

    const blobPromise = new Promise((resolve) => {
      URL.createObjectURL = (blob) => {
        createdBlobs.push(blob);
        resolve(blob);
        return 'blob:mock-pdf-url';
      };
    });

    await exportDocumentAsPdf('Financial-Report-2026', pages);
    const blob = await blobPromise;

    expect(blob).to.exist;
    expect(blob.type).to.equal('application/pdf');
    expect(blob.size).to.be.above(0);
    expect(downloadedFilenames).to.include('Financial-Report-2026.pdf');
  });

  it('exportDocumentAsImages for multi-page document produces a valid ZIP blob without throwing', async () => {
    const pages = [
      { id: 'p1', src: createTestImageDataUrl(20, 20, '#10b981') },
      { id: 'p2', src: createTestImageDataUrl(20, 20, '#6366f1') },
      { id: 'p3', src: createTestImageDataUrl(20, 20, '#a855f7') },
    ];

    const blobPromise = new Promise((resolve) => {
      URL.createObjectURL = (blob) => {
        createdBlobs.push(blob);
        resolve(blob);
        return 'blob:mock-zip-url';
      };
    });

    await exportDocumentAsImages('Project-Scans', pages);
    const blob = await blobPromise;

    expect(blob).to.exist;
    expect(blob.size).to.be.above(0);
    expect(downloadedFilenames).to.include('Project-Scans.zip');

    // Verify valid ZIP structure by reading with JSZip
    const JSZip = await loadJsZip();
    const zip = await JSZip.loadAsync(blob);
    const filesInZip = Object.keys(zip.files);
    expect(filesInZip.length).to.be.at.least(2);
  });

  it('exportDocumentAsImages for single image page triggers direct image download', async () => {
    const pages = [
      { id: 'p1', src: createTestImageDataUrl(50, 50, '#ec4899') },
    ];

    await exportDocumentAsImages('Single-Scan', pages);

    expect(downloadedFilenames).to.include('Single-Scan.png');
  });

  it('handles empty page export gracefully without unhandled exceptions', async () => {
    await exportDocumentAsPdf('Empty', []);
    expect(notifyMessages).to.include('No images to export');

    await exportDocumentAsImages('Empty', []);
    expect(notifyMessages).to.include('No images to export');
  });

  it('reports determinate progress via onProgress and copio:export-progress during multi-page export', async () => {
    const pages = [
      { id: 'p1', src: createTestImageDataUrl(10, 10, '#f43f5e') },
      { id: 'p2', src: createTestImageDataUrl(10, 10, '#3b82f6') },
      { id: 'p3', src: createTestImageDataUrl(10, 10, '#10b981') },
    ];

    const pdfProgress = [];
    const windowEvents = [];
    const eventHandler = (e) => windowEvents.push(e.detail);
    window.addEventListener('copio:export-progress', eventHandler);

    try {
      await exportDocumentAsPdf('Multi-Page-Doc', pages, {
        onProgress: (done, total) => {
          pdfProgress.push({ done, total });
        },
      });

      expect(pdfProgress).to.deep.equal([
        { done: 1, total: 3 },
        { done: 2, total: 3 },
        { done: 3, total: 3 },
      ]);

      const pdfEvents = windowEvents.filter((e) => e.type === 'pdf');
      expect(pdfEvents.length).to.equal(3);
      expect(pdfEvents[2]).to.deep.include({ done: 3, total: 3, docName: 'Multi-Page-Doc' });

      // Test ZIP export progress
      const zipProgress = [];
      await exportDocumentAsImages('Multi-Page-Doc', pages, {
        onProgress: (done, total) => {
          zipProgress.push({ done, total });
        },
      });

      expect(zipProgress).to.deep.equal([
        { done: 1, total: 3 },
        { done: 2, total: 3 },
        { done: 3, total: 3 },
      ]);

      const zipEvents = windowEvents.filter((e) => e.type === 'zip');
      expect(zipEvents.length).to.equal(3);
      expect(zipEvents[2]).to.deep.include({ done: 3, total: 3, docName: 'Multi-Page-Doc' });
    } finally {
      window.removeEventListener('copio:export-progress', eventHandler);
    }
  });

  it('exporting a 30-page doc shows determinate progress and a completion toast (CPO-023)', async () => {
    // Generate 30 lightweight pages
    const sampleImg = createTestImageDataUrl(10, 10, '#64748b');
    const pages = Array.from({ length: 30 }, (_, i) => ({
      id: `p-${i + 1}`,
      src: sampleImg,
    }));

    const progressReports = [];
    await exportDocumentAsPdf('Thirty-Page-Doc', pages, {
      onProgress: (done, total) => {
        progressReports.push({ done, total });
      },
    });

    expect(progressReports.length).to.equal(30);
    expect(progressReports[0]).to.deep.equal({ done: 1, total: 30 });
    expect(progressReports[29]).to.deep.equal({ done: 30, total: 30 });

    // Verify completion toast was shown
    expect(notifyMessages.some((msg) => msg.includes('Exported "Thirty-Page-Doc.pdf"'))).to.be.true;
  });

  describe('Searchable PDF (CPO-070)', () => {
    it('overlays invisible OCR text layer when searchable: true and ocrWords are present', async () => {
      const imgWidth = 200;
      const imgHeight = 300;
      const pages = [
        {
          id: 'p-ocr-1',
          src: createTestImageDataUrl(imgWidth, imgHeight, '#ffffff'),
          ocrWords: [
            { text: 'RECEIPT', bbox: { x0: 20, y0: 30, x1: 90, y1: 50 }, confidence: 98 },
            { text: 'TOTAL', bbox: { x0: 20, y0: 100, x1: 70, y1: 120 }, confidence: 95 },
            { text: '$42.00', bbox: { x0: 120, y0: 100, x1: 180, y1: 120 }, confidence: 99 },
          ],
          ocrWidth: imgWidth,
          ocrHeight: imgHeight,
        },
      ];

      const blob = await exportDocumentAsPdf('Searchable-Receipt', pages, {
        searchable: true,
        download: false,
      });

      expect(blob).to.exist;
      expect(blob.type).to.equal('application/pdf');

      // Verify searchable text items using pdfjsLib
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      expect(pdf.numPages).to.equal(1);
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();

      const fullText = textContent.items.map((i) => i.str).join('');
      expect(fullText).to.include('RECEIPT');
      expect(fullText).to.include('TOTAL');
      expect(fullText).to.include('$42.00');

      // Verify bounding box alignment
      const receiptItem = textContent.items.find((i) => i.str === 'RECEIPT');
      expect(receiptItem).to.exist;
      expect(receiptItem.width).to.be.above(0);
      expect(receiptItem.height).to.be.above(0);
    });

    it('standard export without searchable option does not include text layer', async () => {
      const pages = [
        {
          id: 'p-no-search',
          src: createTestImageDataUrl(100, 100, '#ffffff'),
          ocrWords: [{ text: 'INVISIBLE_SHOULD_NOT_EXIST', bbox: { x0: 10, y0: 10, x1: 80, y1: 30 } }],
        },
      ];

      const blob = await exportDocumentAsPdf('NonSearchable-Doc', pages, {
        searchable: false,
        download: false,
      });

      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      expect(textContent.items.length).to.equal(0);
    });

    it('runs on-demand OCR during export if page has no stored result and searchable is true', async () => {
      const imgWidth = 80;
      const imgHeight = 80;
      const testPage = {
        id: 'p-ondemand',
        src: createTestImageDataUrl(imgWidth, imgHeight, '#ffffff'),
        // No ocrWords!
      };

      // Create a test doc in docRepository to verify persistence
      await docRepository.init();
      const doc = await docRepository.createDoc('OnDemand-Doc', [testPage]);

      let onDemandOcrCalled = false;
      const mockRecognizeImageText = async () => {
        onDemandOcrCalled = true;
        return {
          text: 'ON DEMAND OCR RESULT',
          confidence: 96,
          words: [
            { text: 'ON_DEMAND', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 96 },
            { text: 'RESULT', bbox: { x0: 55, y0: 10, x1: 80, y1: 25 }, confidence: 96 },
          ],
        };
      };

      const blob = await exportDocumentAsPdf('OnDemand-Doc', [testPage], {
        searchable: true,
        download: false,
        recognizeImageText: mockRecognizeImageText,
        onOcrComplete: async () => {
          await docRepository.saveDoc(doc.id, doc);
        },
      });

      expect(blob).to.exist;
      expect(onDemandOcrCalled).to.be.true;

      // testPage in memory should now have ocrWords populated
      expect(testPage.ocrWords).to.be.an('array');
      expect(testPage.ocrWords.length).to.equal(2);
      expect(testPage.ocrText).to.equal('ON DEMAND OCR RESULT');

      const savedDoc = await docRepository.getDoc(doc.id);
      expect(savedDoc.pages[0].ocrWords).to.be.an('array');
      expect(savedDoc.pages[0].ocrWords[0].text).to.equal('ON_DEMAND');

      // Verify text layer was embedded into exported PDF
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      const pdfPage = await pdf.getPage(1);
      const textContent = await pdfPage.getTextContent();
      const extractedText = textContent.items.map((i) => i.str).join('');
      expect(extractedText).to.include('ON_DEMAND');
      expect(extractedText).to.include('RESULT');
    });

    it('emits copio:export-complete with searchable: true detail flag', async () => {
      let exportEventDetail = null;
      const onExportComplete = (e) => {
        exportEventDetail = e.detail;
      };
      window.addEventListener('copio:export-complete', onExportComplete);

      try {
        const pages = [{ id: 'p1', src: createTestImageDataUrl(20, 20) }];
        await exportDocumentAsPdf('Searchable-Event-Test', pages, {
          searchable: true,
          download: false,
        });

        expect(exportEventDetail).to.exist;
        expect(exportEventDetail.searchable).to.be.true;
      } finally {
        window.removeEventListener('copio:export-complete', onExportComplete);
      }
    });
  });
});

