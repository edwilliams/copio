import { expect } from '@esm-bundle/chai';
import { exportDocumentAsPdf, exportDocumentAsImages, exportDocumentAsMarkdown } from '../js/services/export-utils.js';

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
  let alertMessages = [];
  let originalAlert;

  beforeEach(() => {
    createdBlobs = [];
    downloadedFilenames = [];
    alertMessages = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalAnchorClick = HTMLAnchorElement.prototype.click;
    originalAlert = window.alert;

    URL.createObjectURL = (blob) => {
      createdBlobs.push(blob);
      return 'blob:mock-export-url';
    };
    URL.revokeObjectURL = () => {};

    HTMLAnchorElement.prototype.click = function () {
      downloadedFilenames.push(this.download);
    };

    window.alert = (msg) => {
      alertMessages.push(msg);
    };
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
    window.alert = originalAlert;
  });

  it('exportDocumentAsPdf produces a valid PDF blob without throwing', async () => {
    const pages = [
      { id: 'p1', src: createTestImageDataUrl(40, 40, '#f97316') },
      { id: 'p2', type: 'markdown', name: 'Meeting Notes', content: '# Summary\nAction points:\n- Point 1\n- Point 2' },
    ];

    const blobPromise = new Promise((resolve) => {
      const orig = URL.createObjectURL;
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
      const orig = URL.createObjectURL;
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
    expect(alertMessages).to.include('No images to export');

    await exportDocumentAsImages('Empty', []);
    expect(alertMessages).to.include('No images to export');

    exportDocumentAsMarkdown('Empty', []);
    expect(alertMessages).to.include('No markdown text in this document');
  });
});
