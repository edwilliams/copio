import { expect } from '@esm-bundle/chai';
import {
  getAssetBase,
  setAssetBase,
  resolveAssetUrl,
  loadCropper,
  loadPdfKit,
  loadJsZip,
  loadMarked,
  loadPeerJs,
  loadQrCode,
  loadTesseract,
} from '../js/utils/module-loader.js';

describe('CPO-031: Module & Asset Loader', () => {
  const originalAssetBase = getAssetBase();

  afterEach(() => {
    setAssetBase(originalAssetBase);
  });

  describe('Asset Base Configuration & Resolution', () => {
    it('defaults assetBase to "."', () => {
      setAssetBase('.');
      expect(getAssetBase()).to.equal('.');
    });

    it('sets and sanitizes assetBase trailing slashes', () => {
      setAssetBase('https://cdn.example.com/copio-assets/');
      expect(getAssetBase()).to.equal('https://cdn.example.com/copio-assets');

      setAssetBase('/custom/path///');
      expect(getAssetBase()).to.equal('/custom/path');
    });

    it('resolveAssetUrl preserves absolute URLs unaltered', () => {
      setAssetBase('https://cdn.example.com/assets');
      expect(resolveAssetUrl('https://tessdata.projectnaptha.com/4.0.0_fast')).to.equal('https://tessdata.projectnaptha.com/4.0.0_fast');
      expect(resolveAssetUrl('http://localhost:3000/test.wasm')).to.equal('http://localhost:3000/test.wasm');
      expect(resolveAssetUrl('data:image/png;base64,abc')).to.equal('data:image/png;base64,abc');
      expect(resolveAssetUrl('blob:http://localhost/uuid')).to.equal('blob:http://localhost/uuid');
    });

    it('resolveAssetUrl resolves relative paths against assetBase', () => {
      setAssetBase('.');
      expect(resolveAssetUrl('js/lib/tesseract-worker.min.js')).to.equal('js/lib/tesseract-worker.min.js');
      expect(resolveAssetUrl('/js/lib/tesseract-core')).to.equal('js/lib/tesseract-core');

      setAssetBase('https://cdn.example.com/copio');
      expect(resolveAssetUrl('js/lib/pdf.worker.min.mjs')).to.equal('https://cdn.example.com/copio/js/lib/pdf.worker.min.mjs');
      expect(resolveAssetUrl('/assets/tessdata')).to.equal('https://cdn.example.com/copio/assets/tessdata');
    });
  });

  describe('Lazy Module Loading & Idempotency', () => {
    it('loadCropper dynamically loads Cropper and is idempotent', async () => {
      const Cropper1 = await loadCropper();
      expect(Cropper1).to.exist;
      expect(window.Cropper).to.equal(Cropper1);

      const Cropper2 = await loadCropper();
      expect(Cropper2).to.equal(Cropper1);

      // Verify no duplicate script tags exist for cropper.js
      const scriptTags = Array.from(document.querySelectorAll('script')).filter((s) => s.src.includes('cropper.js'));
      expect(scriptTags.length).to.be.at.most(1);
    });

    it('loadPdfKit dynamically loads PDFKit (window.PDFDocument)', async () => {
      const PDFDocument = await loadPdfKit();
      expect(PDFDocument).to.exist;
      expect(window.PDFDocument).to.equal(PDFDocument);

      const doc = new PDFDocument({ autoFirstPage: false });
      expect(doc).to.be.an('object');
      expect(typeof doc.addPage).to.equal('function');
    });

    it('loadJsZip dynamically loads JSZip (window.JSZip)', async () => {
      const JSZip = await loadJsZip();
      expect(JSZip).to.exist;
      expect(window.JSZip).to.equal(JSZip);

      const zip = new JSZip();
      expect(zip).to.be.an('object');
      expect(typeof zip.file).to.equal('function');
    });

    it('loadMarked dynamically loads marked (window.marked)', async () => {
      const marked = await loadMarked();
      expect(marked).to.exist;
      expect(window.marked).to.equal(marked);
      expect(typeof marked.parse).to.equal('function');

      const parsed = marked.parse('# Heading');
      expect(parsed).to.include('<h1');
    });

    it('loadPeerJs dynamically loads PeerJS (window.Peer)', async () => {
      const Peer = await loadPeerJs();
      expect(Peer).to.exist;
      expect(window.Peer).to.equal(Peer);
    });

    it('loadQrCode dynamically loads qrcode (window.qrcode)', async () => {
      const qrcode = await loadQrCode();
      expect(qrcode).to.exist;
      expect(window.qrcode).to.equal(qrcode);

      const qr = qrcode(0, 'M');
      expect(qr).to.exist;
      expect(typeof qr.addData).to.equal('function');
    });

    it('loadTesseract dynamically loads Tesseract (window.Tesseract)', async () => {
      const Tesseract = await loadTesseract();
      expect(Tesseract).to.exist;
      expect(window.Tesseract).to.equal(Tesseract);
      expect(typeof Tesseract.createWorker).to.equal('function');
    });
  });

  describe('Verification: Zero Third-Party Classic Script Tags in index.html', () => {
    it('index.html contains no classic third-party <script> tags for cropper, pdfkit, jszip, marked, peerjs, qrcode, or tesseract', async () => {
      const res = await fetch('/index.html');
      const html = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const scripts = Array.from(doc.querySelectorAll('script'));

      const classicThirdParty = scripts.filter((s) => {
        const src = s.getAttribute('src');
        if (!src) return false;
        return (
          src.includes('cropper.js') ||
          src.includes('pdfkit.js') ||
          src.includes('jszip.min.js') ||
          src.includes('marked.min.js') ||
          src.includes('peerjs.min.js') ||
          src.includes('qrcode.js') ||
          src.includes('tesseract.min.js')
        );
      });

      expect(classicThirdParty).to.be.empty;
    });
  });
});
