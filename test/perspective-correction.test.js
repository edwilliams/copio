import { expect } from '@esm-bundle/chai';
import {
  CopioEngine,
  MemoryStorageAdapter,
  Canvas2DAdapter,
  normalizeEditStack,
  normalizeQuad,
  hasActiveEdits,
  rotateQuad,
  quadOriginalToRotated,
  quadRotatedToOriginal,
} from '../sdk/core.js';
import '../sdk/scanner.js';
import { applyEdits, renderEditsToCanvas } from '../js/utils/utils.js';
import { computeQuadDimensions, solveUnitSquareHomography } from '../js/utils/perspective.js';
import { exportDocumentAsPdf } from '../js/services/export-utils.js';
import { CURRENT_SCHEMA_VERSION, MigrationRunner } from '../js/services/migration-runner.js';

function createSkewedDocumentCanvas(width = 200, height = 200) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Trapezoidal white "document" at an angle:
  // TL(40, 20), TR(160, 30), BR(185, 175), BL(15, 165)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(40, 20);
  ctx.lineTo(160, 30);
  ctx.lineTo(185, 175);
  ctx.lineTo(15, 165);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

describe('CPO-075: Perspective Correction', function () {
  this.timeout(15000);

  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer?.remove();
    fixtureContainer = null;
  });

  describe('Homography & Perspective Warp', () => {
    it('warps a trapezoidal angled photo into an undistorted rectangular page', async () => {
      const srcCanvas = createSkewedDocumentCanvas(200, 200);
      const quad = {
        topLeft: { x: 40 / 200, y: 20 / 200 },
        topRight: { x: 160 / 200, y: 30 / 200 },
        bottomRight: { x: 185 / 200, y: 175 / 200 },
        bottomLeft: { x: 15 / 200, y: 165 / 200 },
      };

      const warped = renderEditsToCanvas(srcCanvas, { quad });
      const expectedDims = computeQuadDimensions({
        topLeft: { x: 40, y: 20 },
        topRight: { x: 160, y: 30 },
        bottomRight: { x: 185, y: 175 },
        bottomLeft: { x: 15, y: 165 },
      });

      expect(warped.width).to.equal(expectedDims.width);
      expect(warped.height).to.equal(expectedDims.height);
      expect(warped.width).to.be.greaterThan(150);
      expect(warped.height).to.be.greaterThan(130);

      // Verify interior & near-corner pixels are white (undistorted document, no dark background)
      const ctx = warped.getContext('2d');
      const samples = [
        ctx.getImageData(4, 4, 1, 1).data,
        ctx.getImageData(warped.width - 5, 4, 1, 1).data,
        ctx.getImageData(warped.width - 5, warped.height - 5, 1, 1).data,
        ctx.getImageData(4, warped.height - 5, 1, 1).data,
        ctx.getImageData(Math.floor(warped.width / 2), Math.floor(warped.height / 2), 1, 1).data,
      ];
      for (const px of samples) {
        expect(px[0]).to.be.at.least(240);
        expect(px[1]).to.be.at.least(240);
        expect(px[2]).to.be.at.least(240);
      }
    });

    it('solves unit-square homography mapping (0,0),(1,0),(1,1),(0,1) to exact quad corners', () => {
      const pixelQuad = {
        topLeft: { x: 30, y: 15 },
        topRight: { x: 170, y: 25 },
        bottomRight: { x: 190, y: 180 },
        bottomLeft: { x: 10, y: 170 },
      };
      const { a, b, c, d, e, f, g, h } = solveUnitSquareHomography(pixelQuad);
      const evalPt = (u, v) => {
        const denom = g * u + h * v + 1;
        return { x: (a * u + b * v + c) / denom, y: (d * u + e * v + f) / denom };
      };

      expect(evalPt(0, 0).x).to.be.closeTo(pixelQuad.topLeft.x, 1e-6);
      expect(evalPt(0, 0).y).to.be.closeTo(pixelQuad.topLeft.y, 1e-6);
      expect(evalPt(1, 0).x).to.be.closeTo(pixelQuad.topRight.x, 1e-6);
      expect(evalPt(1, 0).y).to.be.closeTo(pixelQuad.topRight.y, 1e-6);
      expect(evalPt(1, 1).x).to.be.closeTo(pixelQuad.bottomRight.x, 1e-6);
      expect(evalPt(1, 1).y).to.be.closeTo(pixelQuad.bottomRight.y, 1e-6);
      expect(evalPt(0, 1).x).to.be.closeTo(pixelQuad.bottomLeft.x, 1e-6);
      expect(evalPt(0, 1).y).to.be.closeTo(pixelQuad.bottomLeft.y, 1e-6);
    });

    it('applyEdits produces a valid data URL when edits.quad is provided', async () => {
      const srcCanvas = createSkewedDocumentCanvas(120, 120);
      const originalSrc = srcCanvas.toDataURL('image/png');
      const quad = {
        topLeft: { x: 0.2, y: 0.1 },
        topRight: { x: 0.8, y: 0.15 },
        bottomRight: { x: 0.9, y: 0.85 },
        bottomLeft: { x: 0.1, y: 0.8 },
      };
      const warpedSrc = await applyEdits(originalSrc, { quad });
      expect(warpedSrc).to.be.a('string');
      expect(warpedSrc).to.not.equal(originalSrc);
    });
  });

  describe('Quad Model, Rotation Transforms & Schema Migration', () => {
    it('normalizeEditStack preserves valid edits.quad and hasActiveEdits detects it', () => {
      const quad = {
        topLeft: { x: 0.1, y: 0.1 },
        topRight: { x: 0.9, y: 0.1 },
        bottomRight: { x: 0.9, y: 0.9 },
        bottomLeft: { x: 0.1, y: 0.9 },
      };
      const norm = normalizeEditStack({ quad });
      expect(norm.quad).to.deep.equal(quad);
      expect(hasActiveEdits({ quad })).to.equal(true);
      expect(normalizeQuad(null)).to.be.null;
    });

    it('quadOriginalToRotated and quadRotatedToOriginal round-trip cleanly across 90, 180, 270 degrees', () => {
      const quad = {
        topLeft: { x: 0.12, y: 0.08 },
        topRight: { x: 0.85, y: 0.14 },
        bottomRight: { x: 0.92, y: 0.88 },
        bottomLeft: { x: 0.06, y: 0.82 },
      };
      for (const rot of [0, 90, 180, 270]) {
        const rotated = quadOriginalToRotated(quad, rot);
        const restored = quadRotatedToOriginal(rotated, rot);
        for (const k of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
          expect(restored[k].x).to.be.closeTo(quad[k].x, 1e-5);
          expect(restored[k].y).to.be.closeTo(quad[k].y, 1e-5);
        }
      }
      expect(rotateQuad(null, 90)).to.be.null;
    });

    it('MigrationRunner upgrades v2 documents without edits.quad to v3 idempotently', async () => {
      expect(CURRENT_SCHEMA_VERSION).to.equal(3);
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.setSchemaVersion(2);
      await storage.saveDoc('doc-v2', {
        id: 'doc-v2',
        name: 'Legacy v2 Doc',
        pages: [{ id: 'p1', src: 'data:image/png;base64,AAA', edits: { crop: null, rotate: 0, filter: 'none' } }],
      });

      const res = await MigrationRunner.run({ storage });
      expect(res.toVersion).to.equal(3);
      expect(res.applied).to.include(3);

      const migratedDoc = await storage.getDoc('doc-v2');
      const pages = typeof migratedDoc.pages === 'string' ? JSON.parse(migratedDoc.pages) : migratedDoc.pages;
      expect(pages[0].edits).to.have.property('quad', null);
    });
  });

  describe('4-Corner Crop UI & Magnifier in <copio-scanner>', () => {
    it('renders 4 >=44px corner handles, shows magnifier on drag, and saves edits.quad', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'single');
      fixtureContainer.appendChild(scanner);

      const canvas = createSkewedDocumentCanvas(200, 200);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'skewed.png', { type: 'image/png' });
      await scanner.addFiles([file]);

      await scanner.toggleCropMode();
      const shadow = scanner.shadowRoot;
      const stageImg = shadow.getElementById('stage-img');
      if (!stageImg.complete || !stageImg.naturalWidth) {
        await new Promise((resolve) => {
          stageImg.addEventListener('load', resolve, { once: true });
          setTimeout(resolve, 100);
        });
      }
      const handles = shadow.querySelectorAll('.copio-quad-handle');
      expect(handles.length).to.equal(4);

      for (const h of handles) {
        const rect = h.getBoundingClientRect();
        expect(rect.width).to.be.at.least(44);
        expect(rect.height).to.be.at.least(44);
      }

      const tlHandle = shadow.querySelector('.copio-quad-handle[data-corner="topLeft"]');
      const wrapper = shadow.getElementById('canvas-wrapper');
      const wrapperRect = wrapper.getBoundingClientRect();

      tlHandle.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        composed: true,
        clientX: wrapperRect.left + wrapperRect.width * 0.05,
        clientY: wrapperRect.top + wrapperRect.height * 0.05,
      }));

      const magnifier = shadow.getElementById('crop-magnifier');
      expect(magnifier.style.display).to.equal('block');

      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: wrapperRect.left + wrapperRect.width * 0.2,
        clientY: wrapperRect.top + wrapperRect.height * 0.1,
      }));
      window.dispatchEvent(new PointerEvent('pointerup', {}));

      expect(magnifier.style.display).to.equal('none');

      // Apply crop
      await scanner.toggleCropMode();
      const pages = await scanner.getPages();
      expect(pages[0].edits.quad).to.exist;
      expect(pages[0].edits.quad.topLeft.x).to.be.greaterThan(0.12);
    });
  });

  describe('Searchable PDF Alignment on Warped Pages (CPO-070)', () => {
    it('invalidates stale ocrWords on quad warp and aligns on-demand OCR boxes to warped dimensions', async () => {
      const storage = new MemoryStorageAdapter();
      const engine = new CopioEngine({
        storage,
        imageProcessor: new Canvas2DAdapter(),
      });
      await engine.init();

      const srcCanvas = createSkewedDocumentCanvas(200, 200);
      const originalSrc = srcCanvas.toDataURL('image/png');
      const doc = await engine.createDocument('Warped Searchable', [
        {
          id: 'p1',
          src: originalSrc,
          originalSrc,
          ocrText: 'STALE_TEXT',
          ocrWords: [{ text: 'STALE_TEXT', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 } }],
          ocrWidth: 200,
          ocrHeight: 200,
        },
      ]);

      const quad = {
        topLeft: { x: 40 / 200, y: 20 / 200 },
        topRight: { x: 160 / 200, y: 30 / 200 },
        bottomRight: { x: 185 / 200, y: 175 / 200 },
        bottomLeft: { x: 15 / 200, y: 165 / 200 },
      };

      const warpedPage = await engine.applyEdit(doc.id, 'p1', { quad });
      // Stale OCR cleared so Searchable PDF will run OCR against warped image
      expect(warpedPage.ocrWords).to.be.null;
      expect(warpedPage.ocrWidth).to.be.null;

      const updatedDoc = await engine.getDocument(doc.id);
      let recognizedSrc = null;
      const pdfBlob = await exportDocumentAsPdf('warped-searchable', updatedDoc.pages, {
        searchable: true,
        download: false,
        recognizeImageText: async (src) => {
          recognizedSrc = src;
          return {
            text: 'WARPED_ALIGNED',
            confidence: 98,
            words: [{ text: 'WARPED_ALIGNED', bbox: { x0: 12, y0: 14, x1: 120, y1: 36 } }],
          };
        },
      });

      expect(pdfBlob).to.be.instanceof(Blob);
      expect(pdfBlob.size).to.be.greaterThan(200);
      expect(recognizedSrc).to.equal(warpedPage.src);
      expect(updatedDoc.pages[0].ocrWords[0].text).to.equal('WARPED_ALIGNED');
      // ocrWidth/ocrHeight must match the warped image dimensions, not 200x200
      expect(updatedDoc.pages[0].ocrWidth).to.be.below(200);
      expect(updatedDoc.pages[0].ocrHeight).to.be.below(200);
    });
  });
});
