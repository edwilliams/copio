import type { CopioScanner } from '../sdk/scanner.js';
import type { CopioImages } from '../js/routes/doc/copio-images.js';
import type { CopioCarousel } from '../js/routes/doc/copio-carousel.js';
import type { CopioRow } from '../js/routes/home/copio-row.js';
import type { CopioHeader } from '../js/components/copio-header.js';
import type { CopioLoader } from '../js/components/copio-loader.js';
import type { CopioAddEditDialog } from '../js/routes/add-edit/copio-add-edit-dialog.js';
import type { CopioDocOcrDialog } from '../js/routes/ocr/copio-doc-ocr-dialog.js';
import type { CopioSyncDialog } from '../js/routes/sync/copio-sync-dialog.js';

declare global {
  interface HTMLElementTagNameMap {
    'copio-scanner': CopioScanner;
    'copio-images': CopioImages;
    'copio-carousel': CopioCarousel;
    'copio-row': CopioRow;
    'copio-header': CopioHeader;
    'copio-loader': CopioLoader;
    'copio-add-edit-dialog': CopioAddEditDialog;
    'copio-doc-ocr-dialog': CopioDocOcrDialog;
    'copio-sync-dialog': CopioSyncDialog;
  }
}

export {};
