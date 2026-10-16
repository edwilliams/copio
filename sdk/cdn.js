/**
 * Copio Standalone CDN Bundle (CPO-060, CPO-062)
 * Registers custom elements and attaches Copio namespace to window.
 */
import * as Copio from './index.js';

// Auto-register elements in global environment
if (typeof window !== 'undefined') {
  /** @type {any} */ (window).Copio = Copio;
}

export * from './index.js';
export default Copio;
