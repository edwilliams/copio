/**
 * Core Domain Models & Entities (CPO-045 Hexagonal Architecture)
 *
 * Pure JavaScript domain models with zero DOM and zero Lit dependencies.
 */

/**
 * Normalizes an edit stack object with safe defaults.
 * @param {Object} [edits]
 * @returns {{ crop: { x: number, y: number, w: number, h: number } | null, rotate: 0|90|180|270, filter: 'none'|'bw' }}
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

  /** @type {0|90|180|270} */
  let rotate = 0;
  if (edits && edits.rotate !== undefined) {
    const r = ((Math.round(Number(edits.rotate) / 90) * 90) % 360 + 360) % 360;
    if (r === 90 || r === 180 || r === 270) {
      rotate = /** @type {0|90|180|270} */ (r);
    }
  }

  const filter = (edits && edits.filter === 'bw') ? 'bw' : 'none';

  return { crop, rotate, filter };
}

/**
 * Checks whether an edit stack contains any non-default modifications.
 * @param {Object} [edits]
 * @returns {boolean}
 */
export function hasActiveEdits(edits) {
  if (!edits) return false;
  return Boolean(
    edits.crop ||
    (edits.rotate && edits.rotate !== 0) ||
    (edits.filter && edits.filter !== 'none')
  );
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
