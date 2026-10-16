import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import { exportDocumentAsPdf, exportDocumentAsImages, exportDocumentAsMarkdown } from '../js/services/export-utils.js';
import notify from '../js/services/notify.js';
import { loadJsZip } from '../js/utils/module-loader.js';

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
      return 'blob:mock-export-url';
    };
    URL.revokeObjectURL = () => {};

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
      { id: 'p2', type: 'markdown', name: 'Meeting Notes', content: '# Summary\nAction points:\n- Point 1\n- Point 2' },
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
      { id: 'p3', type: 'markdown', name: 'Note', content: 'Notes text for page 3' },
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

  it('exportDocumentAsMarkdown produces a valid Markdown file without throwing', () => {
    const pages = [
      { id: 'p1', type: 'markdown', name: 'Checklist', content: '- [x] Done\n- [ ] Todo' },
    ];

    exportDocumentAsMarkdown('Checklist-Doc', pages);

    expect(createdBlobs.length).to.be.at.least(1);
    const mdBlob = createdBlobs.find((b) => b.type.includes('markdown'));
    expect(mdBlob).to.exist;
    expect(mdBlob.size).to.be.above(0);
    expect(downloadedFilenames).to.include('Checklist-Doc.md');
  });

  it('handles empty page export gracefully without unhandled exceptions', async () => {
    await exportDocumentAsPdf('Empty', []);
    expect(notifyMessages).to.include('No images to export');

    await exportDocumentAsImages('Empty', []);
    expect(notifyMessages).to.include('No images to export');

    exportDocumentAsMarkdown('Empty', []);
    expect(notifyMessages).to.include('No markdown text in this document');
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
});

