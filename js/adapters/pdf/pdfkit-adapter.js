/**
 * PdfKitAdapter — Default Driven Adapter for PDF assembly via PDFKit (CPO-042, CPO-045).
 */
import { PdfPort } from './pdf-port.js';
import { exportDocumentAsPdf } from '../../services/export-utils.js';
import { renderPdfPagesToDataUrls } from '../../utils/pdf-utils.js';

export class PdfKitAdapter extends PdfPort {
  /**
   * @param {string} docName
   * @param {Array<any>} pages
   * @param {Object} [options]
   */
  async exportDocumentAsPdf(docName, pages, options = {}) {
    return exportDocumentAsPdf(docName, pages, options);
  }

  /**
   * @param {File|Blob|ArrayBuffer} fileOrBuffer
   */
  async renderPdfPagesToDataUrls(fileOrBuffer) {
    const buffer = fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : await fileOrBuffer.arrayBuffer();
    return renderPdfPagesToDataUrls(buffer);
  }
}
