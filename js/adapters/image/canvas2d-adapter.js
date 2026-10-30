/**
 * Canvas2DAdapter (CPO-045 ImageProcessorPort implementation)
 * 
 * Uses browser Canvas2D and image utilities (renderEditsToCanvas)
 * for non-destructive rendering of crop, rotate, and Sauvola B&W filters.
 */
import { ImageProcessorPort } from './image-processor-port.js';
import { renderEditsToCanvas } from '../../utils/utils.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export class Canvas2DAdapter extends ImageProcessorPort {
  /**
   * Applies non-destructive edits (crop, rotate, filter) to an original image source.
   * @param {string} originalSrc
   * @param {Object} edits
   * @returns {Promise<string>}
   */
  async renderEdits(originalSrc, edits = {}) {
    if (!originalSrc) return '';
    if (typeof document === 'undefined') {
      return originalSrc;
    }
    try {
      const img = await loadImage(originalSrc);
      const normalizedEdits = { ...edits };
      if (edits?.crop && 'w' in edits.crop) {
        normalizedEdits.crop = {
          x: Math.round((edits.crop.x || 0) * img.naturalWidth),
          y: Math.round((edits.crop.y || 0) * img.naturalHeight),
          width: Math.round((edits.crop.w || 1) * img.naturalWidth),
          height: Math.round((edits.crop.h || 1) * img.naturalHeight),
        };
      }
      if (edits?.rotate !== undefined) {
        normalizedEdits.rotation = edits.rotate;
      }
      const canvas = renderEditsToCanvas(img, normalizedEdits);
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch {
      return originalSrc;
    }
  }

  /**
   * Crops an image source using normalized coordinates.
   * @param {string} src
   * @param {{ x: number, y: number, w: number, h: number }} crop
   * @returns {Promise<string>}
   */
  async crop(src, crop) {
    return this.renderEdits(src, { crop });
  }

  /**
   * Rotates an image source.
   * @param {string} src
   * @param {number} degrees
   * @returns {Promise<string>}
   */
  async rotate(src, degrees) {
    return this.renderEdits(src, { rotate: degrees });
  }

  /**
   * Applies Sauvola adaptive B&W threshold to an image source.
   * @param {string} src
   * @param {'bw'|'none'} filter
   * @returns {Promise<string>}
   */
  async applyFilter(src, filter) {
    return this.renderEdits(src, { filter });
  }
}
