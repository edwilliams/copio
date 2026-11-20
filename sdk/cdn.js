// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio Standalone CDN Bundle (CPO-060, CPO-062)
 * Registers custom elements and attaches Copio namespace to window.
 */
import { getAssetBase, setAssetBase } from '../js/utils/module-loader.js';
import * as Copio from './index.js';

// Auto-resolve assetBase relative to this bundle (CDN or self-hosted dist/)
// when not explicitly configured via setAssetBase(...) or <copio-scanner asset-base="...">.
if (typeof import.meta !== 'undefined' && import.meta.url && getAssetBase() === '.') {
  setAssetBase(new URL('.', import.meta.url).href);
}

// Auto-register elements in global environment
if (typeof window !== 'undefined') {
  /** @type {any} */ (window).Copio = Copio;
}

export * from './index.js';
export default Copio;
