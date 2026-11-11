import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scansDir = path.join(__dirname, 'fixtures', 'scans');
const groundTruthPath = path.join(scansDir, 'ground-truth.json');

/**
 * Parse binary JPEG SOF0/SOF1/SOF2 marker to extract { width, height } without external dependencies.
 * @param {Buffer} buf
 * @returns {{ width: number, height: number }}
 */
function readJpegDimensions(buf) {
  assert.equal(buf[0], 0xff, 'Expected JPEG SOI 0xFF');
  assert.equal(buf[1], 0xd8, 'Expected JPEG SOI 0xD8');
  let offset = 2;
  while (offset < buf.length) {
    while (offset < buf.length && buf[offset] !== 0xff) offset++;
    while (offset < buf.length && buf[offset] === 0xff) offset++;
    if (offset >= buf.length) break;
    const marker = buf[offset];
    offset++;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    const segLen = buf.readUInt16BE(offset);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += segLen;
  }
  throw new Error('Could not find SOF marker in JPEG buffer');
}

/**
 * Signed Shoelace area in screen coordinates (y-down: positive = clockwise).
 * @param {Array<{x: number, y: number}>} pts
 */
function signedPolygonArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return area / 2;
}

/**
 * Verify a 4-point polygon is strictly convex.
 * @param {Array<{x: number, y: number}>} pts
 */
function isConvexQuad(pts) {
  if (pts.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (sign !== s) return false;
  }
  return true;
}

/**
 * Sutherland-Hodgman convex polygon clipping for quadrilateral IoU verification.
 * @param {Array<{x: number, y: number}>} subject
 * @param {Array<{x: number, y: number}>} clip
 */
function clipPolygon(subject, clip) {
  const norm = (pts) => (signedPolygonArea(pts) < 0 ? pts.slice().reverse() : pts);
  const inside = (p, a, b) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
  const intersect = (p1, p2, a, b) => {
    const A1 = b.y - a.y;
    const B1 = a.x - b.x;
    const C1 = A1 * a.x + B1 * a.y;
    const A2 = p2.y - p1.y;
    const B2 = p1.x - p2.x;
    const C2 = A2 * p1.x + B2 * p1.y;
    const det = A1 * B2 - A2 * B1;
    if (Math.abs(det) < 1e-9) return p2;
    return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
  };

  let output = norm(subject);
  const clipPoly = norm(clip);
  for (let i = 0; i < clipPoly.length && output.length > 0; i++) {
    const a = clipPoly[i];
    const b = clipPoly[(i + 1) % clipPoly.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currIn = inside(curr, a, b);
      const prevIn = inside(prev, a, b);
      if (currIn) {
        if (!prevIn) output.push(intersect(prev, curr, a, b));
        output.push(curr);
      } else if (prevIn) {
        output.push(intersect(prev, curr, a, b));
      }
    }
  }
  return output;
}

function computeQuadIoU(cornersA, cornersB) {
  const polyA = [cornersA.topLeft, cornersA.topRight, cornersA.bottomRight, cornersA.bottomLeft];
  const polyB = [cornersB.topLeft, cornersB.topRight, cornersB.bottomRight, cornersB.bottomLeft];
  const areaA = Math.abs(signedPolygonArea(polyA));
  const areaB = Math.abs(signedPolygonArea(polyB));
  if (areaA <= 0 || areaB <= 0) return 0;
  const inter = clipPolygon(polyA, polyB);
  const interArea = inter.length >= 3 ? Math.abs(signedPolygonArea(inter)) : 0;
  const unionArea = areaA + areaB - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

test('CPO-073 shared scan fixture dataset contains >= 30 real photos with valid 4-corner ground truth', () => {
  assert.ok(fs.existsSync(groundTruthPath), 'ground-truth.json must exist in test/fixtures/scans/');
  const gt = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));

  const entries = Object.entries(gt.images || {});
  assert.ok(entries.length >= 30, `Expected >= 30 scan fixtures, found ${entries.length}`);
  assert.equal(gt.totalImages, entries.length);

  const categoryCounts = { receipt: 0, a4_document: 0, id_card: 0 };
  const conditionCounts = { flat: 0, angled: 0, low_contrast: 0, cluttered: 0 };

  for (const [filename, meta] of entries) {
    const imgPath = path.join(scansDir, filename);
    assert.ok(fs.existsSync(imgPath), `Missing fixture image on disk: ${filename}`);

    const buf = fs.readFileSync(imgPath);
    assert.ok(buf.length > 5000, `Fixture ${filename} should be a real photo (> 5 KB)`);

    const dims = readJpegDimensions(buf);
    assert.equal(dims.width, meta.width, `Width mismatch for ${filename}`);
    assert.equal(dims.height, meta.height, `Height mismatch for ${filename}`);

    assert.ok(
      meta.category in categoryCounts,
      `Unexpected category "${meta.category}" for ${filename}`
    );
    categoryCounts[meta.category]++;

    assert.ok(Array.isArray(meta.conditions) && meta.conditions.length >= 1, `Missing conditions for ${filename}`);
    for (const cond of meta.conditions) {
      if (cond in conditionCounts) conditionCounts[cond]++;
    }

    const { corners, normalizedCorners } = meta;
    assert.ok(corners && normalizedCorners, `Missing corners or normalizedCorners for ${filename}`);

    const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (const k of keys) {
      const pt = corners[k];
      const npt = normalizedCorners[k];
      assert.ok(Number.isFinite(pt?.x) && Number.isFinite(pt?.y), `Non-finite corner ${k} in ${filename}`);
      assert.ok(pt.x >= 0 && pt.x <= meta.width, `Corner ${k}.x out of bounds in ${filename}`);
      assert.ok(pt.y >= 0 && pt.y <= meta.height, `Corner ${k}.y out of bounds in ${filename}`);

      assert.ok(Number.isFinite(npt?.x) && Number.isFinite(npt?.y), `Non-finite normalizedCorner ${k} in ${filename}`);
      assert.ok(npt.x >= 0 && npt.x <= 1, `normalizedCorner ${k}.x out of [0, 1] in ${filename}`);
      assert.ok(npt.y >= 0 && npt.y <= 1, `normalizedCorner ${k}.y out of [0, 1] in ${filename}`);

      assert.ok(
        Math.abs(pt.x - npt.x * meta.width) <= 0.5,
        `Pixel/normalized x mismatch for ${k} in ${filename}`
      );
      assert.ok(
        Math.abs(pt.y - npt.y * meta.height) <= 0.5,
        `Pixel/normalized y mismatch for ${k} in ${filename}`
      );
    }

    const poly = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
    const signedArea = signedPolygonArea(poly);
    assert.ok(signedArea > 0, `Expected clockwise corner winding (signedArea > 0) in ${filename}`);
    assert.ok(isConvexQuad(poly), `Expected convex quadrilateral in ${filename}`);

    const coverage = signedArea / (meta.width * meta.height);
    assert.ok(
      coverage >= 0.03 && coverage <= 0.99,
      `Expected document coverage in [0.03, 0.99] for ${filename}, got ${coverage.toFixed(3)}`
    );

    // Self-IoU must be 1.0
    assert.ok(Math.abs(computeQuadIoU(corners, corners) - 1.0) < 1e-6);
  }

  // Verify category diversity (receipts, A4 documents, ID cards)
  assert.ok(categoryCounts.receipt >= 8, `Expected >= 8 receipts, found ${categoryCounts.receipt}`);
  assert.ok(categoryCounts.a4_document >= 8, `Expected >= 8 A4 documents, found ${categoryCounts.a4_document}`);
  assert.ok(categoryCounts.id_card >= 8, `Expected >= 8 ID cards, found ${categoryCounts.id_card}`);

  // Verify background & capture condition diversity (flat, angled, low-contrast, cluttered)
  assert.ok(conditionCounts.flat >= 5, `Expected >= 5 flat fixtures, found ${conditionCounts.flat}`);
  assert.ok(conditionCounts.angled >= 5, `Expected >= 5 angled fixtures, found ${conditionCounts.angled}`);
  assert.ok(conditionCounts.low_contrast >= 5, `Expected >= 5 low_contrast fixtures, found ${conditionCounts.low_contrast}`);
  assert.ok(conditionCounts.cluttered >= 5, `Expected >= 5 cluttered fixtures, found ${conditionCounts.cluttered}`);

  // Verify CPO-071 lighting/paper regression fixture mappings exist
  const cpo071Required = ['shadowed_receipt', 'angled_white_page', 'id_card', 'yellow_paper', 'low_light'];
  for (const tag of cpo071Required) {
    const mappedFile = gt.cpo071Fixtures?.[tag];
    assert.ok(mappedFile && gt.images[mappedFile], `Missing CPO-071 fixture mapping for ${tag}`);
  }
});

test('CPO-073 ADR write-up exists and documents all required candidate measurements (when docs submodule is checked out)', (t) => {
  const adrDir = path.join(rootDir, 'docs', 'adr');
  if (!fs.existsSync(adrDir)) {
    t.skip('docs submodule not checked out in this environment');
    return;
  }

  const adrPaths = [
    path.join(adrDir, '0002-edge-detection.md'),
    path.join(adrDir, '0003-edge-detection.md'),
  ];

  for (const adrPath of adrPaths) {
    assert.ok(fs.existsSync(adrPath), `Expected ADR file at ${adrPath}`);
    const content = fs.readFileSync(adrPath, 'utf8');
    assert.ok(content.includes('OpenCV.js'), 'ADR must evaluate OpenCV.js');
    assert.ok(content.includes('Scanic'), 'ADR must evaluate Scanic');
    assert.ok(content.includes('jscanify'), 'ADR must evaluate jscanify');
    assert.ok(content.includes('Hand-Rolled JS Baseline'), 'ADR must evaluate hand-rolled baseline');
    assert.ok(content.includes('90.6%'), 'ADR must record hit rate vs ground truth');
    assert.ok(content.includes('AGPL-3.0'), 'ADR must evaluate licence compatibility with CPO-001');
  }
});
