/**
 * Copio SDK Public Events Catalogue (CPO-036)
 * 
 * Standardized CustomEvents dispatched by <copio-scanner> and Copio SDK components.
 * All public events are configured with bubbles: true and composed: true to cross
 * Shadow DOM boundaries into the host application.
 */

/**
 * Public event name constants.
 * @readonly
 * @enum {string}
 */
export const COPIO_EVENTS = {
  PAGE_ADDED: 'copio:page-added',
  PAGE_REMOVED: 'copio:page-removed',
  PAGES_CHANGED: 'copio:pages-changed',
  SCAN_COMPLETE: 'copio:scan-complete',
  EXPORT_PROGRESS: 'copio:export-progress',
  EXPORT_COMPLETE: 'copio:export-complete',
  OCR_COMPLETE: 'copio:ocr-complete',
  SYNC_CONNECTED: 'copio:sync-connected',
  ERROR: 'copio:error',
};

/**
 * Dispatch a standard public Copio CustomEvent.
 * Configured with bubbles: true and composed: true so it crosses shadow boundaries.
 * 
 * @param {EventTarget} target - Element or target dispatching the event
 * @param {string} eventName - One of COPIO_EVENTS or a custom copio:* event string
 * @param {Object} [detail={}] - Event payload data
 * @returns {CustomEvent} The dispatched event
 */
export function dispatchCopioEvent(target, eventName, detail = {}) {
  const event = new CustomEvent(eventName, {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail,
  });
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(event);
  }
  return event;
}

/**
 * Type definitions for JSDoc documentation and autocompletion:
 * 
 * @typedef {Object} CopioPageAddedDetail
 * @property {Object} page - Page entity containing id, src, type, etc.
 * @property {number} pageNumber - 1-based page index
 * @property {string} [docId] - Associated document ID
 * @property {string} [source] - Source origin ('camera' | 'file' | 'import')
 * 
 * @typedef {Object} CopioPageRemovedDetail
 * @property {string} pageId - ID of removed page
 * @property {string} [docId] - Associated document ID
 * 
 * @typedef {Object} CopioPagesChangedDetail
 * @property {Array<Object>} pages - Current list of pages
 * @property {string} [docId] - Associated document ID
 * 
 * @typedef {Object} CopioScanCompleteDetail
 * @property {string} docId - ID of document scanned
 * @property {Array<Object>} pages - List of captured pages
 * @property {number} pageCount - Number of pages in the scan
 * 
 * @typedef {Object} CopioExportProgressDetail
 * @property {string} type - Export format ('pdf' | 'zip' | 'image' | 'markdown')
 * @property {number} done - Pages completed
 * @property {number} total - Total pages
 * @property {number} percent - Progress percent (0-100)
 * @property {string} [docName] - Document name
 * 
 * @typedef {Object} CopioExportCompleteDetail
 * @property {string} type - Export format ('pdf' | 'zip' | 'image' | 'markdown')
 * @property {string} format - Duplicate of type for convenience
 * @property {Blob} blob - The generated export binary Blob
 * @property {string} [docName] - Document name
 * @property {string} [docId] - Associated document ID
 * 
 * @typedef {Object} CopioOcrCompleteDetail
 * @property {string} text - Extracted combined text
 * @property {Array<Object>} pages - Per-page OCR results with text and confidence
 * @property {number} averageConfidence - Mean confidence score (0-100)
 * @property {string} [docId] - Associated document ID
 * @property {string} [pageId] - Specific page ID if single page OCR
 * 
 * @typedef {Object} CopioSyncConnectedDetail
 * @property {string} peerId - Connected peer ID
 * @property {string} mode - 'host' or 'client'
 * 
 * @typedef {Object} CopioErrorDetail
 * @property {string} code - Error classification code (e.g. 'FEATURE_DISABLED')
 * @property {string} message - Human-readable error description
 * @property {Error} [error] - Underlying Error object if available
 */
