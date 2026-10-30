/**
 * Copio SDK
 * Embeddable Web Components and Headless Services for Document Scanning,
 * OCR, Editing, and P2P Sync.
 * 
 * Free of navigation side-effects and offline precaching side-effects.
 */

// Driving UI Adapters & Web Components
export {
  CopioScanner,
  scannerCss,
  getScannerStyleSheet,
  adoptScannerStyles,
} from './scanner.js';
export { CopioImages } from '../js/routes/doc/copio-images.js';
export { CopioCarousel } from '../js/routes/doc/copio-carousel.js';
export { CopioDocOcrDialog } from '../js/routes/ocr/copio-doc-ocr-dialog.js';
export { CopioSyncDialog } from '../js/routes/sync/copio-sync-dialog.js';
export { CopioAddEditDialog } from '../js/routes/add-edit/copio-add-edit-dialog.js';
export { CopioRow } from '../js/routes/home/copio-row.js';
export { CopioHeader } from '../js/components/copio-header.js';
export { CopioLoader } from '../js/components/copio-loader.js';

// Hexagonal Core & Licensing (CPO-045, CPO-053, CPO-061)
export { CopioEngine } from './core.js';
export { COPIO_EVENTS, dispatchCopioEvent } from './events.js';
export { LicenseManager } from './license.js';
export { BUILD_DATE, VERSION } from './version.js';

// Headless Services & Utilities
export {
  recognizeImageText,
  recognizeDocumentPages,
  getOcrWorker,
  terminateOcrWorker,
  SUPPORTED_LANGUAGES,
} from '../js/services/ocr-service.js';

export { SyncManager } from '../js/services/sync-service.js';

export {
  exportDocumentAsPdf,
  exportDocumentAsImages,
  exportDocumentAsMarkdown,
} from '../js/services/export-utils.js';

export {
  notify,
  setContainer,
  getContainer,
  clear as clearNotifications,
} from '../js/services/notify.js';

export {
  randomId,
  fileToBase64,
  thresholdSrc,
  rotateSrc,
  getCroppedSrc,
  extractExif,
} from '../js/utils/utils.js';

export { renderPdfPagesToDataUrls } from '../js/utils/pdf-utils.js';

// Module & Asset Loaders (CPO-031)
export {
  getAssetBase,
  setAssetBase,
  resolveAssetUrl,
  loadScript,
  loadCropper,
  loadPdfKit,
  loadJsZip,
  loadMarked,
  loadPeerJs,
  loadQrCode,
  loadTesseract,
} from '../js/utils/module-loader.js';

// Data Layer & StoragePort (CPO-014, CPO-033)
export { DocRepository, docRepository } from '../js/services/doc-repository.js';
export {
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  createDefaultAdapter,
} from '../js/adapters/storage/index.js';

// Driven Ports & Adapters (Hexagonal Architecture CPO-042, CPO-045)
export {
  OcrPort,
  NullOcrAdapter,
  TesseractWasmAdapter,
} from '../js/adapters/ocr/index.js';

export {
  PdfPort,
  NullPdfAdapter,
  PdfKitAdapter,
} from '../js/adapters/pdf/index.js';

export {
  ImageProcessorPort,
  Canvas2DAdapter,
  NullImageProcessorAdapter,
} from '../js/adapters/image/index.js';

export {
  SyncPort,
  PeerJsAdapter,
  NullSyncAdapter,
} from '../js/adapters/sync/index.js';

export {
  Document,
  Page,
  ScanSession,
  normalizeEditStack,
  hasActiveEdits,
} from './models.js';

// Register Default Driven Ports (Hexagonal Architecture)
import { registerService } from './core.js';
import * as exportService from '../js/services/export-utils.js';
import { SyncManager } from '../js/services/sync-service.js';
import { TesseractWasmAdapter } from '../js/adapters/ocr/tesseract-wasm-adapter.js';
import { PdfKitAdapter } from '../js/adapters/pdf/pdfkit-adapter.js';
import { Canvas2DAdapter } from '../js/adapters/image/canvas2d-adapter.js';

registerService('export', exportService);
registerService('ocr', new TesseractWasmAdapter());
registerService('sync', SyncManager);
registerService('pdf', new PdfKitAdapter());
registerService('imageProcessor', new Canvas2DAdapter());

export { registerService, getRegisteredService } from './core.js';
