// SPDX-License-Identifier: AGPL-3.0
/**
 * Copio SDK
 * Embeddable Web Components and Headless Services for Document Scanning,
 * OCR, Editing, and P2P Sync.
 *
 * Free of navigation side-effects and offline precaching side-effects.
 */

// ── Public: Web Components ───────────────────────────────────────────────────
export { CopioScanner } from './scanner.js';
export { CopioHandoff } from './handoff.js';

// ── Public: Headless Engine, Events & Domain Models ──────────────────────────
export { CopioEngine } from './core.js';
export { COPIO_EVENTS } from './events.js';
export { VERSION } from './version.js';
export { Document, Page, ScanSession } from './models.js';

// ── Public: Asset Base Configuration & Headless Helpers ──────────────────────
export { getAssetBase, setAssetBase } from '../js/utils/module-loader.js';
export { recognizeImageText, recognizeDocumentPages } from '../js/services/ocr-service.js';
export { exportDocumentAsPdf, exportDocumentAsImages } from '../js/services/export-utils.js';

// ── Public / Advanced: Storage Port & Shipped Adapters ───────────────────────
export {
  StoragePort,
  MemoryStorageAdapter,
  IndexedDbStorageAdapter,
  OpfsStorageAdapter,
  createDefaultAdapter,
} from '../js/adapters/storage/index.js';

// ── Advanced: Driven Ports & Shipped Adapters ────────────────────────────────
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
  EdgeDetectorPort,
  NullEdgeDetectorAdapter,
  ScanicWasmEdgeAdapter,
} from '../js/adapters/edge/index.js';

// ── Advanced / Experimental: Handoff Session & Schema Migrations ─────────────
export { HandoffSession, LoopbackTransport } from './handoff-session.js';
export { MigrationRunner, CURRENT_SCHEMA_VERSION } from '../js/services/migration-runner.js';

// ── Default Driven Service Registration (batteries-included root entry) ──────
// Registers default OCR, PDF, Image, Edge, Sync, and Export services so
// `<copio-scanner>` and `CopioEngine` work out of the box when importing `@copio/sdk`.
// Consumers wanting zero-side-effect tree-shaking should import `@copio/sdk/core`
// or `@copio/sdk/scanner` and register only the adapters they need.
import { registerService, getRegisteredService } from './core.js';
import * as exportService from '../js/services/export-utils.js';
import { SyncManager } from '../js/services/sync-service.js';
import { TesseractWasmAdapter } from '../js/adapters/ocr/tesseract-wasm-adapter.js';
import { PdfKitAdapter } from '../js/adapters/pdf/pdfkit-adapter.js';
import { Canvas2DAdapter } from '../js/adapters/image/canvas2d-adapter.js';
import { ScanicWasmEdgeAdapter } from '../js/adapters/edge/scanic-wasm-adapter.js';

registerService('export', exportService);
registerService('ocr', new TesseractWasmAdapter());
registerService('sync', SyncManager);
registerService('pdf', new PdfKitAdapter());
registerService('imageProcessor', new Canvas2DAdapter());
registerService('edge', new ScanicWasmEdgeAdapter());

export { registerService, getRegisteredService };
