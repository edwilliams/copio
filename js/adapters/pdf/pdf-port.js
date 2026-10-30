/**
 * PdfPort — Outbound/Driven Port for PDF Export & Import (Hexagonal Architecture / CPO-042, CPO-045).
 * 
 * Defines the contract that all PDF adapters (PDFKit, Null, Native/Browser) must implement.
 */

export class PdfPort {
  /**
   * Export document pages as a PDF Blob.
   * @param {string} _docName
   * @param {Array<any>} _pages
   * @param {Object} [_options]
   * @returns {Promise<Blob|undefined>}
   */
  async exportDocumentAsPdf(_docName, _pages, _options = {}) {
    throw new Error('PdfPort.exportDocumentAsPdf() must be implemented by adapter');
  }

  /**
   * Render pages of a PDF File or ArrayBuffer to image data URLs.
   * @param {File|Blob|ArrayBuffer} _fileOrBuffer
   * @returns {Promise<string[]>}
   */
  async renderPdfPagesToDataUrls(_fileOrBuffer) {
    throw new Error('PdfPort.renderPdfPagesToDataUrls() must be implemented by adapter');
  }
}
