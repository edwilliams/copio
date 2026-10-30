/**
 * NullPdfAdapter — No-Op Driven Adapter for PDF (CPO-042).
 * 
 * Used when PDF export/import is disabled or opted out by developer.
 * Guarantees ZERO dynamic imports, ZERO PDFKit downloads, and ZERO network requests.
 */
import { PdfPort } from './pdf-port.js';

export class NullPdfAdapter extends PdfPort {
  /**
   * Throws FEATURE_DISABLED error to prevent network requests.
   * @param {string} _docName
   * @param {Array<any>} _pages
   * @param {Object} [_options]
   * @returns {Promise<any>}
   */
  async exportDocumentAsPdf(_docName, _pages, _options = {}) {
    const err = new Error('Feature "pdf" is disabled or PDF module not opted in');
    // @ts-ignore
    err.code = 'FEATURE_DISABLED';
    throw err;
  }

  /**
   * Returns empty array without importing pdf-utils or making network calls.
   * @param {File|Blob|ArrayBuffer} _fileOrBuffer
   * @returns {Promise<string[]>}
   */
  async renderPdfPagesToDataUrls(_fileOrBuffer) {
    return [];
  }
}
