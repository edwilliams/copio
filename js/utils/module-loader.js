/**
 * Copio Module & Asset Loader
 * 
 * Provides lazy, asynchronous dynamic loading for third-party libraries:
 * - Cropper.js (window.Cropper)
 * - PDFKit (window.PDFDocument)
 * - JSZip (window.JSZip)
 * - Marked (window.marked)
 * - PeerJS (window.Peer)
 * - QRCode (window.qrcode)
 * - Tesseract.js (window.Tesseract)
 * 
 * Eliminates classic global <script> tags from initial page load and provides
 * a configurable assetBase for worker, WASM, and language assets.
 */

let configuredAssetBase = '.';

/**
 * Get the currently configured asset base URL.
 * @returns {string}
 */
export function getAssetBase() {
  return configuredAssetBase;
}

/**
 * Configure the asset base URL for worker, WASM, and library scripts.
 * @param {string} base 
 */
export function setAssetBase(base) {
  if (typeof base === 'string') {
    configuredAssetBase = base.replace(/\/+$/, '') || '.';
  }
}

/**
 * Resolves a relative asset path against the configured assetBase.
 * Absolute URLs (http://, https://, data:, blob:) are returned unchanged.
 * @param {string} path 
 * @returns {string}
 */
export function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^(https?:|\/\/|data:|blob:)/i.test(path)) {
    return path;
  }
  const cleanPath = path.replace(/^\/+/, '');
  const base = configuredAssetBase;
  if (!base || base === '.') {
    return cleanPath;
  }
  return `${base}/${cleanPath}`;
}

const loadPromises = new Map();

/**
 * Dynamically loads an external script if not already present.
 * Caches the load Promise to ensure idempotent loading without duplicate injections.
 * 
 * @param {string} relativeSrc Path relative to assetBase
 * @param {() => any} checkGlobal Function returning the global if already loaded
 * @returns {Promise<any>}
 */
export function loadScript(relativeSrc, checkGlobal) {
  const existing = checkGlobal();
  if (existing) {
    return Promise.resolve(existing);
  }

  if (loadPromises.has(relativeSrc)) {
    return loadPromises.get(relativeSrc);
  }

  const promise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error(`Cannot load script "${relativeSrc}" in an environment without DOM document.`));
      return;
    }

    const scriptUrl = resolveAssetUrl(relativeSrc);

    // Check if script tag already exists in DOM
    const existingTag = document.querySelector(`script[src="${scriptUrl}"], script[src="${relativeSrc}"]`);
    if (existingTag) {
      if (checkGlobal()) {
        resolve(checkGlobal());
        return;
      }
      existingTag.addEventListener('load', () => resolve(checkGlobal()), { once: true });
      existingTag.addEventListener('error', (err) => reject(new Error(`Failed to load "${relativeSrc}": ${err?.message || 'Network error'}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;

    script.onload = () => {
      const result = checkGlobal();
      resolve(result);
    };

    script.onerror = (err) => {
      loadPromises.delete(relativeSrc);
      script.remove();
      reject(new Error(`Failed to load script "${relativeSrc}": ${err?.message || 'Network error'}`));
    };

    document.head.appendChild(script);
  });

  loadPromises.set(relativeSrc, promise);
  return promise;
}

/**
 * Lazy loads Cropper.js on demand.
 * @returns {Promise<typeof Cropper>}
 */
export async function loadCropper() {
  return loadScript('js/lib/cropper.js', () => window.Cropper);
}

/**
 * Lazy loads PDFKit (PDFDocument) on demand.
 * @returns {Promise<any>}
 */
export async function loadPdfKit() {
  return loadScript('js/lib/pdfkit.js', () => window.PDFDocument);
}

/**
 * Lazy loads JSZip on demand.
 * @returns {Promise<any>}
 */
export async function loadJsZip() {
  return loadScript('js/lib/jszip.min.js', () => window.JSZip);
}

/**
 * Lazy loads marked markdown parser on demand.
 * @returns {Promise<any>}
 */
export async function loadMarked() {
  return loadScript('js/lib/marked.min.js', () => window.marked);
}

/**
 * Lazy loads PeerJS on demand.
 * @returns {Promise<any>}
 */
export async function loadPeerJs() {
  return loadScript('js/lib/peerjs.min.js', () => window.Peer);
}

/**
 * Lazy loads qrcode generator on demand.
 * @returns {Promise<any>}
 */
export async function loadQrCode() {
  return loadScript('js/lib/qrcode.js', () => window.qrcode);
}

/**
 * Lazy loads Tesseract.js on demand.
 * @returns {Promise<any>}
 */
export async function loadTesseract() {
  return loadScript('js/lib/tesseract.min.js', () => window.Tesseract);
}
