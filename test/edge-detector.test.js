import { expect } from '@esm-bundle/chai';
import {
  EdgeDetectorPort,
  NullEdgeDetectorAdapter,
  ScanicWasmEdgeAdapter,
  DEFAULT_FALLBACK_QUAD,
  cloneQuad,
  getRegisteredService,
} from '../sdk/index.js';

/**
 * Compute unsigned area of a polygon.
 * @param {Array<{x: number, y: number}>} pts
 */
function polygonArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Sutherland-Hodgman polygon clipping against a directed half-plane edge p1 -> p2.
 */
function clipPolygonByEdge(subject, p1, p2) {
  const out = [];
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const inside = (p) => cross(p1, p2, p) >= -1e-9;
  const intersect = (a, b) => {
    const dx1 = b.x - a.x;
    const dy1 = b.y - a.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-12) return a;
    const t = ((p1.x - a.x) * dy2 - (p1.y - a.y) * dx2) / denom;
    return { x: a.x + t * dx1, y: a.y + t * dy1 };
  };
  for (let i = 0; i < subject.length; i++) {
    const curr = subject[i];
    const prev = subject[(i + subject.length - 1) % subject.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);
    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

function ensureClockwiseScreen(pts) {
  let signed = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    signed += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return signed < 0 ? [...pts].reverse() : pts;
}

/**
 * Compute Intersection-over-Union (IoU) between two 4-corner quads.
 */
function computeQuadIoU(qA, qB) {
  if (!qA || !qB) return 0;
  const polyA = ensureClockwiseScreen([qA.topLeft, qA.topRight, qA.bottomRight, qA.bottomLeft]);
  const polyB = ensureClockwiseScreen([qB.topLeft, qB.topRight, qB.bottomRight, qB.bottomLeft]);
  const areaA = polygonArea(polyA);
  const areaB = polygonArea(polyB);
  if (areaA <= 1e-9 || areaB <= 1e-9) return 0;
  let clipped = polyA;
  for (let i = 0; i < polyB.length; i++) {
    clipped = clipPolygonByEdge(clipped, polyB[i], polyB[(i + 1) % polyB.length]);
    if (clipped.length < 3) return 0;
  }
  const inter = polygonArea(clipped);
  const union = areaA + areaB - inter;
  return union > 1e-9 ? Math.max(0, Math.min(1, inter / union)) : 0;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

describe('Auto Edge Detection — Worker & EdgeDetectorPort Adapter (CPO-074)', () => {
  it('registers ScanicWasmEdgeAdapter as the default "edge" service in @copio/sdk', () => {
    const service = getRegisteredService('edge');
    expect(service).to.be.an.instanceof(EdgeDetectorPort);
    expect(service).to.be.an.instanceof(ScanicWasmEdgeAdapter);
  });

  it('EdgeDetectorPort base methods throw when not implemented by subclass', async () => {
    const port = new EdgeDetectorPort();
    let detectErr = null;
    try {
      await port.detect({});
    } catch (err) {
      detectErr = err;
    }
    expect(detectErr).to.exist;
    expect(detectErr.message).to.include('must be implemented');

    let workerErr = null;
    try {
      await port.getEdgeWorker();
    } catch (err) {
      workerErr = err;
    }
    expect(workerErr).to.exist;
    expect(workerErr.message).to.include('must be implemented');
  });

  it('NullEdgeDetectorAdapter returns null with zero Worker side effects and optionally throws FEATURE_DISABLED', async () => {
    const nullAdapter = new NullEdgeDetectorAdapter();
    expect(await nullAdapter.getEdgeWorker()).to.be.null;
    expect(await nullAdapter.detect(new ImageData(10, 10))).to.be.null;
    await nullAdapter.terminateEdgeWorker();

    const strictNull = new NullEdgeDetectorAdapter({ throwOnDetect: true });
    let errCaught = null;
    try {
      await strictNull.detect(new ImageData(10, 10));
    } catch (err) {
      errCaught = err;
    }
    expect(errCaught).to.exist;
    expect(errCaught.code).to.equal('FEATURE_DISABLED');
  });

  it('ScanicWasmEdgeAdapter lazily spawns a dedicated Web Worker, preserves caller ImageData, and handles fallback', async () => {
    const adapter = new ScanicWasmEdgeAdapter();
    try {
      const worker = await adapter.getEdgeWorker();
      expect(worker).to.be.an.instanceof(Worker);

      // Create a canvas with a bright tilted document on a dark background
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 500;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 400, 500);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(60, 70);
      ctx.lineTo(340, 80);
      ctx.lineTo(330, 430);
      ctx.lineTo(50, 420);
      ctx.closePath();
      ctx.fill();
      // Add subtle document text lines so ML DocCornerNet recognizes it as a document
      ctx.fillStyle = '#334155';
      for (let y = 120; y <= 360; y += 36) {
        ctx.fillRect(95, y, 200, 10);
      }

      const imgData = ctx.getImageData(0, 0, 400, 500);
      const res = await adapter.detect(imgData);

      // Caller's ImageData buffer must NOT be neutered by worker transfer
      expect(imgData.data.byteLength).to.equal(400 * 500 * 4);

      expect(res).to.exist;
      expect(res.isFallback).to.be.false;
      expect(res.confidence).to.be.at.least(0.55);
      expect(res.width).to.equal(400);
      expect(res.height).to.equal(500);

      const expected = {
        topLeft: { x: 60 / 400, y: 70 / 500 },
        topRight: { x: 340 / 400, y: 80 / 500 },
        bottomRight: { x: 330 / 400, y: 430 / 500 },
        bottomLeft: { x: 50 / 400, y: 420 / 500 },
      };
      expect(computeQuadIoU(res.quad, expected)).to.be.at.least(0.9);

      // Blank canvas -> low confidence -> returns null by default, or 5%-inset quad when fallbackOnLowConfidence=true
      const blankCanvas = document.createElement('canvas');
      blankCanvas.width = 200;
      blankCanvas.height = 200;
      const blankCtx = blankCanvas.getContext('2d');
      blankCtx.fillStyle = '#808080';
      blankCtx.fillRect(0, 0, 200, 200);

      const noDetection = await adapter.detect(blankCanvas);
      expect(noDetection).to.be.null;

      const fallbackDetection = await adapter.detect(blankCanvas, {
        fallbackOnLowConfidence: true,
      });
      expect(fallbackDetection).to.exist;
      expect(fallbackDetection.isFallback).to.be.true;
      expect(fallbackDetection.quad).to.deep.equal(cloneQuad(DEFAULT_FALLBACK_QUAD));
    } finally {
      await adapter.terminateEdgeWorker();
    }
  });

  it('supports ML Neural detector backend option and switches cleanly', async () => {
    const adapter = new ScanicWasmEdgeAdapter({ detector: 'ml' });
    expect(adapter.detector).to.equal('ml');
    adapter.detector = 'classical';
    expect(adapter.detector).to.equal('classical');
    adapter.detector = 'ml';
    expect(adapter.detector).to.equal('ml');
    expect(typeof adapter.preloadMl).to.equal('function');
  });

  it('achieves >= 80% detection accuracy (IoU >= 0.70) across the 32-photo CPO-073 labelled scan test set', async function () {
    this.timeout(30000);

    const gtRes = await fetch('/test/fixtures/scans/ground-truth.json');
    expect(gtRes.ok).to.be.true;
    const gt = await gtRes.json();
    const entries = Object.entries(gt.images);
    expect(entries.length).to.be.at.least(30);

    const adapter = new ScanicWasmEdgeAdapter({
      maxProcessingDimension: 800,
      enableDetectionCascade: true,
      minConfidence: 0.5,
    });

    let hits70 = 0;
    let hits50 = 0;

    try {
      for (const [filename, meta] of entries) {
        const img = await loadImage(`/test/fixtures/scans/${filename}`);
        const det = await adapter.detect(img);
        const iou = det ? computeQuadIoU(det.normalizedCorners, meta.normalizedCorners) : 0;
        if (iou >= 0.7) hits70++;
        if (iou >= 0.5) hits50++;
      }
    } finally {
      await adapter.terminateEdgeWorker();
    }

    const hitRate70 = hits70 / entries.length;
    const hitRate50 = hits50 / entries.length;

    expect(hitRate70).to.be.at.least(
      0.8,
      `Expected >= 80% hit rate (IoU >= 0.70) on 32-photo scan fixture set, got ${(hitRate70 * 100).toFixed(1)}% (${hits70}/${entries.length})`
    );
    expect(hitRate50).to.be.at.least(0.85);
  });
});
