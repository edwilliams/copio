/**
 * OcrPort — Outbound/Driven Port for Optical Character Recognition (Hexagonal Architecture / CPO-042, CPO-045).
 * 
 * Defines the contract that all OCR adapters (Tesseract WASM, Null, Cloud) must implement.
 */

/**
 * @typedef {Object} OcrProgress
 * @property {string} status - Progress status identifier
 * @property {number} progress - Progress value (0 to 1)
 * @property {string} message - Human-readable status message
 * @property {any} [raw] - Raw worker message
 */

/**
 * @typedef {Object} OcrPageResult
 * @property {string} id - Page identifier
 * @property {string} text - Extracted text content
 * @property {number} confidence - OCR confidence score (0 to 100)
 * @property {Array<any>} [words] - Extracted words
 * @property {Array<any>} [lines] - Extracted lines
 * @property {Array<any>} [paragraphs] - Extracted paragraphs
 * @property {string} [hocr] - hOCR markup
 */

/**
 * @typedef {Object} OcrBatchResult
 * @property {OcrPageResult[]} pagesResults - Per-page extraction results
 * @property {string} combinedText - Aggregated document text
 * @property {number} averageConfidence - Average confidence percentage
 * @property {boolean} [empty] - True if no images were processed
 */

/**
 * Base contract for OCR Port implementations.
 */
export class OcrPort {
  /**
   * Recognize text from a single image.
   * @param {string|Blob|File|HTMLImageElement|HTMLCanvasElement} _image
   * @param {Object} [_options]
   * @returns {Promise<{ text: string, confidence: number, words?: any[], lines?: any[], paragraphs?: any[], hocr?: string }>}
   */
  async recognizeImageText(_image, _options = {}) {
    throw new Error('OcrPort.recognizeImageText() must be implemented by adapter');
  }

  /**
   * Batch recognize text across multiple document pages.
   * @param {Array<{ id: string, src?: string, type?: string, content?: string, name?: string }>} _pages
   * @param {Object} [_options]
   * @returns {Promise<OcrBatchResult>}
   */
  async recognizeDocumentPages(_pages, _options = {}) {
    throw new Error('OcrPort.recognizeDocumentPages() must be implemented by adapter');
  }

  /**
   * Obtain or initialize an active OCR worker instance.
   * @param {string} [_lang='eng']
   * @param {Function} [_onProgress]
   * @returns {Promise<any>}
   */
  async getOcrWorker(_lang = 'eng', _onProgress = null) {
    throw new Error('OcrPort.getOcrWorker() must be implemented by adapter');
  }

  /**
   * Terminate active OCR worker and release resources.
   * @returns {Promise<void>}
   */
  async terminateOcrWorker() {
    throw new Error('OcrPort.terminateOcrWorker() must be implemented by adapter');
  }
}
