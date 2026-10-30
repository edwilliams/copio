/**
 * TesseractWasmAdapter — Default Driven Adapter for OCR via Tesseract.js WASM (CPO-042, CPO-045).
 */
import { OcrPort } from './ocr-port.js';
import {
  recognizeImageText,
  recognizeDocumentPages,
  getOcrWorker,
  terminateOcrWorker,
} from '../../services/ocr-service.js';

export class TesseractWasmAdapter extends OcrPort {
  /**
   * @param {string|Blob|File|HTMLImageElement|HTMLCanvasElement} image
   * @param {Object} [options]
   */
  async recognizeImageText(image, options = {}) {
    return recognizeImageText(image, options);
  }

  /**
   * @param {Array<{ id: string, src?: string, type?: string, content?: string, name?: string }>} pages
   * @param {Object} [options]
   */
  async recognizeDocumentPages(pages, options = {}) {
    return recognizeDocumentPages(pages, options);
  }

  /**
   * @param {string} [lang='eng']
   * @param {Function} [onProgress]
   */
  async getOcrWorker(lang = 'eng', onProgress = null) {
    return getOcrWorker(lang, onProgress);
  }

  async terminateOcrWorker() {
    return terminateOcrWorker();
  }
}
