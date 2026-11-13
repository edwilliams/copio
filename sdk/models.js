// SPDX-License-Identifier: AGPL-3.0
/**
 * Core Domain Models & Entities (CPO-045 Hexagonal Architecture)
 *
 * Pure JavaScript domain models with zero DOM and zero Lit dependencies.
 */

const roundCoord = (n) => Math.round(n * 1e6) / 1e6;
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

/**
 * Normalizes a 4-corner quadrilateral to clamped [0, 1] coordinates.
 * @param {Object|null|undefined} quad
 * @returns {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null}
 */
export function normalizeQuad(quad) {
  if (!quad || typeof quad !== 'object') return null;
  const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
  const out = {};
  for (const k of keys) {
    const pt = quad[k];
    if (!pt || typeof pt !== 'object' || !Number.isFinite(Number(pt.x)) || !Number.isFinite(Number(pt.y))) {
      return null;
    }
    out[k] = {
      x: roundCoord(clamp01(pt.x)),
      y: roundCoord(clamp01(pt.y)),
    };
  }
  return /** @type {any} */ (out);
}

/**
 * Converts a normalized { x, y, w, h } rectangle to a 4-corner quadrilateral.
 * @param {{ x: number, y: number, w: number, h: number } | null} crop
 * @returns {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null}
 */
export function cropRectToQuad(crop) {
  if (!crop || typeof crop !== 'object') return null;
  const x0 = clamp01(crop.x);
  const y0 = clamp01(crop.y);
  const x1 = clamp01(x0 + (Number(crop.w) || 0));
  const y1 = clamp01(y0 + (Number(crop.h) || 0));
  return {
    topLeft: { x: roundCoord(x0), y: roundCoord(y0) },
    topRight: { x: roundCoord(x1), y: roundCoord(y0) },
    bottomRight: { x: roundCoord(x1), y: roundCoord(y1) },
    bottomLeft: { x: roundCoord(x0), y: roundCoord(y1) },
  };
}

/**
 * Normalizes an edit stack object with safe defaults.
 * @param {Object} [edits]
 * @returns {{ crop: { x: number, y: number, w: number, h: number } | null, quad: { topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null, rotate: 0|90|180|270, filter: 'none'|'bw' }}
 */
export function normalizeEditStack(edits = {}) {
  const crop = (edits && edits.crop && typeof edits.crop === 'object')
    ? {
        x: Math.max(0, Math.min(1, Number(edits.crop.x) || 0)),
        y: Math.max(0, Math.min(1, Number(edits.crop.y) || 0)),
        w: Math.max(0, Math.min(1, Number(edits.crop.w) || 1)),
        h: Math.max(0, Math.min(1, Number(edits.crop.h) || 1)),
      }
    : null;

  const quad = normalizeQuad(edits?.quad);

  /** @type {0|90|180|270} */
  let rotate = 0;
  const rawRot = edits?.rotate !== undefined ? edits.rotate : edits?.rotation;
  if (rawRot !== undefined) {
    const r = ((Math.round(Number(rawRot) / 90) * 90) % 360 + 360) % 360;
    if (r === 90 || r === 180 || r === 270) {
      rotate = /** @type {0|90|180|270} */ (r);
    }
  }

  const filter = (edits && edits.filter === 'bw') ? 'bw' : 'none';

  return { crop, quad, rotate, filter };
}

/**
 * Checks whether an edit stack contains any non-default modifications.
 * @param {Object} [edits]
 * @returns {boolean}
 */
export function hasActiveEdits(edits) {
  if (!edits) return false;
  const rot = edits.rotate !== undefined ? edits.rotate : edits.rotation;
  return Boolean(
    edits.crop ||
    normalizeQuad(edits.quad) ||
    (rot && rot !== 0) ||
    (edits.filter && edits.filter !== 'none')
  );
}

/**
 * Transforms normalized crop coordinates through a clockwise rotation angle (0, 90, 180, 270).
 * @param {{ x: number, y: number, w: number, h: number } | null} crop
 * @param {number} [rotation=0] - Clockwise rotation angle in degrees
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function rotateCrop(crop, rotation = 0) {
  if (!crop) return null;
  const rot = ((Math.round(Number(rotation) / 90) * 90) % 360 + 360) % 360;
  const { x, y, w, h } = crop;
  if (rot === 90) {
    return {
      x: roundCoord(Math.max(0, Math.min(1, 1 - y - h))),
      y: roundCoord(Math.max(0, Math.min(1, x))),
      w: roundCoord(Math.max(0.01, Math.min(1, h))),
      h: roundCoord(Math.max(0.01, Math.min(1, w))),
    };
  }
  if (rot === 180) {
    return {
      x: roundCoord(Math.max(0, Math.min(1, 1 - x - w))),
      y: roundCoord(Math.max(0, Math.min(1, 1 - y - h))),
      w: roundCoord(Math.max(0.01, Math.min(1, w))),
      h: roundCoord(Math.max(0.01, Math.min(1, h))),
    };
  }
  if (rot === 270) {
    return {
      x: roundCoord(Math.max(0, Math.min(1, y))),
      y: roundCoord(Math.max(0, Math.min(1, 1 - x - w))),
      w: roundCoord(Math.max(0.01, Math.min(1, h))),
      h: roundCoord(Math.max(0.01, Math.min(1, w))),
    };
  }
  return {
    x: roundCoord(Math.max(0, Math.min(1, x))),
    y: roundCoord(Math.max(0, Math.min(1, y))),
    w: roundCoord(Math.max(0.01, Math.min(1, w))),
    h: roundCoord(Math.max(0.01, Math.min(1, h))),
  };
}

/**
 * Maps normalized crop coordinates on an original unrotated image to a rotated canvas coordinate frame.
 * @param {{ x: number, y: number, w: number, h: number } | null} crop
 * @param {number} [rotation=0]
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function cropOriginalToRotated(crop, rotation = 0) {
  return rotateCrop(crop, rotation);
}

/**
 * Maps normalized crop coordinates on a rotated canvas back to original unrotated image coordinates.
 * @param {{ x: number, y: number, w: number, h: number } | null} crop
 * @param {number} [rotation=0]
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function cropRotatedToOriginal(crop, rotation = 0) {
  return rotateCrop(crop, -rotation);
}

function rotatePointCW(pt, rot) {
  const x = clamp01(pt.x);
  const y = clamp01(pt.y);
  if (rot === 90) return { x: roundCoord(1 - y), y: roundCoord(x) };
  if (rot === 180) return { x: roundCoord(1 - x), y: roundCoord(1 - y) };
  if (rot === 270) return { x: roundCoord(y), y: roundCoord(1 - x) };
  return { x: roundCoord(x), y: roundCoord(y) };
}

/**
 * Transforms normalized quadrilateral coordinates through a clockwise rotation angle (0, 90, 180, 270),
 * remapping corner keys so topLeft/topRight/bottomRight/bottomLeft stay in canonical order.
 * @param {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null} quad
 * @param {number} [rotation=0]
 * @returns {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null}
 */
export function rotateQuad(quad, rotation = 0) {
  const norm = normalizeQuad(quad);
  if (!norm) return null;
  const rot = ((Math.round(Number(rotation) / 90) * 90) % 360 + 360) % 360;
  if (rot === 90) {
    return {
      topLeft: rotatePointCW(norm.bottomLeft, 90),
      topRight: rotatePointCW(norm.topLeft, 90),
      bottomRight: rotatePointCW(norm.topRight, 90),
      bottomLeft: rotatePointCW(norm.bottomRight, 90),
    };
  }
  if (rot === 180) {
    return {
      topLeft: rotatePointCW(norm.bottomRight, 180),
      topRight: rotatePointCW(norm.bottomLeft, 180),
      bottomRight: rotatePointCW(norm.topLeft, 180),
      bottomLeft: rotatePointCW(norm.topRight, 180),
    };
  }
  if (rot === 270) {
    return {
      topLeft: rotatePointCW(norm.topRight, 270),
      topRight: rotatePointCW(norm.bottomRight, 270),
      bottomRight: rotatePointCW(norm.bottomLeft, 270),
      bottomLeft: rotatePointCW(norm.topLeft, 270),
    };
  }
  return norm;
}

/**
 * Maps normalized quad coordinates on an original unrotated image to a rotated canvas coordinate frame.
 * @param {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null} quad
 * @param {number} [rotation=0]
 * @returns {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null}
 */
export function quadOriginalToRotated(quad, rotation = 0) {
  return rotateQuad(quad, rotation);
}

/**
 * Maps normalized quad coordinates on a rotated canvas back to original unrotated image coordinates.
 * @param {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null} quad
 * @param {number} [rotation=0]
 * @returns {{ topLeft: { x: number, y: number }, topRight: { x: number, y: number }, bottomRight: { x: number, y: number }, bottomLeft: { x: number, y: number } } | null}
 */
export function quadRotatedToOriginal(quad, rotation = 0) {
  return rotateQuad(quad, -rotation);
}

/**
 * Page domain entity.
 */
export class Page {
  /**
   * @param {Object} data
   * @param {string} data.id
   * @param {string} data.src - Derived render
   * @param {string} [data.originalSrc] - Raw immutable original
   * @param {Object} [data.edits] - Non-destructive edit stack
   * @param {string} [data.name]
   * @param {string} [data.type]
   * @param {number} [data.orientation]
   * @param {string|null} [data.ocrText]
   * @param {number|null} [data.ocrConfidence]
   * @param {Array<Object>|null} [data.ocrWords]
   * @param {number|null} [data.ocrWidth]
   * @param {number|null} [data.ocrHeight]
   */
  constructor(data) {
    this.id = data.id;
    this.src = data.src;
    this.originalSrc = data.originalSrc || data.src;
    this.edits = normalizeEditStack(data.edits);
    this.name = data.name || 'Page';
    this.type = data.type || 'image';
    this.orientation = data.orientation || 1;
    this.ocrText = data.ocrText || null;
    this.ocrConfidence = data.ocrConfidence ?? null;
    this.ocrWords = Array.isArray(data.ocrWords) ? data.ocrWords : null;
    this.ocrWidth = typeof data.ocrWidth === 'number' ? data.ocrWidth : null;
    this.ocrHeight = typeof data.ocrHeight === 'number' ? data.ocrHeight : null;
  }

  get isModified() {
    return hasActiveEdits(this.edits);
  }

  toJSON() {
    return {
      id: this.id,
      src: this.src,
      originalSrc: this.originalSrc,
      edits: this.edits,
      name: this.name,
      type: this.type,
      orientation: this.orientation,
      ocrText: this.ocrText,
      ocrConfidence: this.ocrConfidence,
      ocrWords: this.ocrWords,
      ocrWidth: this.ocrWidth,
      ocrHeight: this.ocrHeight,
    };
  }
}

/**
 * Document domain entity.
 */
export class Document {
  /**
   * @param {Object} data
   * @param {string} data.id
   * @param {string} data.name
   * @param {Array<Page|Object>} [data.pages]
   * @param {number} [data.createdAt]
   * @param {number} [data.updatedAt]
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name || 'Untitled Document';
    this.pages = Array.isArray(data.pages)
      ? data.pages.map((p) => (p instanceof Page ? p : new Page(p)))
      : [];
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  get pageCount() {
    return this.pages.length;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      pages: this.pages.map((p) => p.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * ScanSession domain model for ongoing capture workflows (CPO-034).
 */
export class ScanSession {
  /**
   * @param {Object} [options]
   * @param {'single'|'batch'} [options.mode='batch']
   * @param {'receipt'|'card'|'a4'|'auto'} [options.aspect='auto']
   * @param {string} [options.docId]
   * @param {number} [options.maxPages=0]
   */
  constructor(options = {}) {
    this.mode = options.mode === 'single' ? 'single' : 'batch';
    this.aspect = options.aspect || 'auto';
    this.docId = options.docId || null;
    this.maxPages = Math.max(0, Number(options.maxPages) || 0);
    this.stage = 'viewfinder'; // 'viewfinder' | 'workbench'
    this.activePageIndex = 0;
    this.history = []; // Undo stack for session
    this.future = [];  // Redo stack for session
  }

  pushHistory(entry) {
    this.history.push(entry);
    this.future = []; // Clear redo on new action
    if (this.history.length > 50) {
      this.history.shift();
    }
  }

  undo() {
    if (this.history.length === 0) return null;
    const action = this.history.pop();
    this.future.push(action);
    return action;
  }

  redo() {
    if (this.future.length === 0) return null;
    const action = this.future.pop();
    this.history.push(action);
    return action;
  }
}
