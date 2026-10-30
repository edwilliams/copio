/**
 * NullOcrAdapter — No-Op Driven Adapter for OCR (CPO-042).
 * 
 * Used when OCR feature is disabled or opted out by developer.
 * Guarantees ZERO dynamic imports, ZERO Tesseract downloads, and ZERO WASM network requests.
 */
import { OcrPort } from './ocr-port.js';

export class NullOcrAdapter extends OcrPort {
  /**
   * Throws FEATURE_DISABLED error to prevent network requests.
   * @param {string|Blob|File|HTMLImageElement|HTMLCanvasElement} _image
   * @param {Object} [_options]
   * @returns {Promise<any>}
   */
  async recognizeImageText(_image, _options = {}) {
    const err = new Error('Feature "ocr" is disabled or OCR module not opted in');
    // @ts-ignore
    err.code = 'FEATURE_DISABLED';
    throw err;
  }

  /**
   * Throws FEATURE_DISABLED error to prevent network requests.
   * @param {Array<{ id: string, src?: string, type?: string, content?: string, name?: string }>} _pages
   * @param {Object} [_options]
   * @returns {Promise<any>}
   */
  async recognizeDocumentPages(_pages, _options = {}) {
    const err = new Error('Feature "ocr" is disabled or OCR module not opted in');
    // @ts-ignore
    err.code = 'FEATURE_DISABLED';
    throw err;
  }

  /**
   * Null worker without instantiating any WASM or worker thread.
   * @returns {Promise<null>}
   */
  async getOcrWorker() {
    return null;
  }

  /**
   * No-op termination.
   * @returns {Promise<void>}
   */
  async terminateOcrWorker() {}
}
