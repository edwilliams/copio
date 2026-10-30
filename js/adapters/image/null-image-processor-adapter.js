/**
 * NullImageProcessorAdapter (CPO-045 ImageProcessorPort fallback)
 * 
 * Safe no-op adapter for headless Node.js or environments without Canvas/DOM.
 * Returns the original image source directly.
 */
import { ImageProcessorPort } from './image-processor-port.js';

export class NullImageProcessorAdapter extends ImageProcessorPort {
  async renderEdits(originalSrc, _edits) {
    return originalSrc;
  }

  async crop(src, _crop) {
    return src;
  }

  async rotate(src, _degrees) {
    return src;
  }

  async applyFilter(src, _filter) {
    return src;
  }
}
