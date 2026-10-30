/**
 * ImageProcessorPort (Hexagonal Architecture Driven Outbound Port CPO-045)
 *
 * Defines the contract for offloading canvas transforms, crop extraction,
 * rotation, and Sauvola adaptive threshold filter rendering.
 */
export class ImageProcessorPort {
  /**
   * Applies non-destructive edits (crop, rotate, filter) to an original image source.
   * @param {string} _originalSrc - Data URL or Object URL of the raw original image
   * @param {Object} _edits - Edit stack { crop, rotate, filter }
   * @returns {Promise<string>} Derived image data URL with edits applied
   */
  async renderEdits(_originalSrc, _edits) {
    throw new Error('ImageProcessorPort.renderEdits() must be implemented by adapter');
  }

  /**
   * Crops an image source.
   * @param {string} _src
   * @param {{ x: number, y: number, w: number, h: number }} _crop - Normalized coordinates
   * @returns {Promise<string>}
   */
  async crop(_src, _crop) {
    throw new Error('ImageProcessorPort.crop() must be implemented by adapter');
  }

  /**
   * Rotates an image source by degrees.
   * @param {string} _src
   * @param {number} _degrees - 90, 180, 270
   * @returns {Promise<string>}
   */
  async rotate(_src, _degrees) {
    throw new Error('ImageProcessorPort.rotate() must be implemented by adapter');
  }

  /**
   * Applies an adaptive or tonal filter to an image source.
   * @param {string} _src
   * @param {'bw'|'none'} _filter
   * @returns {Promise<string>}
   */
  async applyFilter(_src, _filter) {
    throw new Error('ImageProcessorPort.applyFilter() must be implemented by adapter');
  }
}
