import { expect } from '@esm-bundle/chai';
import Copio, {
  CopioScanner,
  COPIO_EVENTS,
  getAssetBase,
  setAssetBase,
  getRegisteredService,
} from '../dist/cdn.js';

describe('CPO-062: CDN & Zero-Build Static Distribution (dist/cdn.js)', function () {
  this.timeout(20000);

  const expectedCdnBase = new URL('../dist', import.meta.url).href.replace(/\/+$/, '');
  const originalAssetBase = getAssetBase();

  afterEach(() => {
    setAssetBase(originalAssetBase);
  });

  it('auto-resolves assetBase from import.meta.url on load and registers <copio-scanner>', () => {
    expect(originalAssetBase).to.equal(expectedCdnBase);
    expect(window.Copio).to.equal(Copio);
    expect(customElements.get('copio-scanner')).to.equal(CopioScanner);
    expect(customElements.get('copio-handoff')).to.exist;
  });

  it('mounts <copio-scanner> with zero asset-base config and preserves auto-resolved assetBase', async () => {
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
    try {
      await new Promise((r) => setTimeout(r, 50));
      expect(scanner.assetBase).to.equal(expectedCdnBase);
      expect(getAssetBase()).to.equal(expectedCdnBase);
    } finally {
      scanner.remove();
    }
  });

  it('allows explicit <copio-scanner asset-base="..."> to override auto-resolved assetBase', async () => {
    const scanner = document.createElement('copio-scanner');
    scanner.setAttribute('asset-base', '/custom-assets/');
    document.body.appendChild(scanner);
    try {
      await new Promise((r) => setTimeout(r, 50));
      expect(scanner.assetBase).to.equal('/custom-assets');
      expect(getAssetBase()).to.equal('/custom-assets');
    } finally {
      scanner.remove();
    }
  });

  it('runs edge detection via Scanic worker & ML/WASM assets resolved from dist/cdn.js base', async () => {
    setAssetBase(expectedCdnBase);
    const edgeAdapter = getRegisteredService('edge');
    expect(edgeAdapter).to.exist;

    // Draw a crisp white document rectangle on a dark background
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(60, 60, 280, 380);

    const result = await edgeAdapter.detect(canvas, { detector: 'classical' });
    expect(result).to.be.an('object');
    expect(result.quad).to.be.an('object');
    expect(result.quad.topLeft).to.have.keys('x', 'y');

    // Also verify ML detector + ONNX Runtime WASM assets resolve from dist/js/lib/
    await edgeAdapter.preloadMl();
    const mlResult = await edgeAdapter.detect(canvas, {
      detector: 'ml',
      fallbackOnLowConfidence: true,
    });
    expect(mlResult).to.be.an('object');
    expect(mlResult.quad).to.be.an('object');
    expect(mlResult.quad.topLeft).to.have.keys('x', 'y');
  });

  it('loads PDFKit from dist/cdn.js base and exports a valid PDF Blob', async () => {
    setAssetBase(expectedCdnBase);
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 280;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 280);
      ctx.fillStyle = '#000000';
      ctx.fillRect(20, 20, 160, 40);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      const file = new File([blob], 'page-1.jpg', { type: 'image/jpeg' });
      await scanner.addFiles([file]);

      const pdfBlob = await scanner.exportPdf({ searchable: false, download: false });
      expect(pdfBlob).to.be.instanceOf(Blob);
      expect(pdfBlob.type).to.equal('application/pdf');
      const header = await pdfBlob.slice(0, 5).text();
      expect(header).to.equal('%PDF-');
    } finally {
      scanner.remove();
    }
  });

  it('loads Tesseract worker, core, and tessdata from dist/cdn.js base and runs OCR', async () => {
    setAssetBase(expectedCdnBase);
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 320, 100);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('COPIO', 40, 62);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'ocr-test.png', { type: 'image/png' });
      await scanner.addFiles([file]);

      let ocrEventDetail = null;
      scanner.addEventListener(COPIO_EVENTS.OCR_COMPLETE, (e) => {
        ocrEventDetail = e.detail;
      });

      const ocrResult = await scanner.ocr();
      expect(ocrResult).to.be.an('object');
      expect(ocrResult.text).to.be.a('string');
      expect(ocrEventDetail).to.exist;
    } finally {
      scanner.remove();
    }
  });
});
