import type { CopioScanner } from '../sdk/scanner.js';
import type { CopioHandoff } from '../sdk/handoff.js';
import type { CopioDocOcrDialog } from '../js/routes/ocr/copio-doc-ocr-dialog.js';
import type { CopioSyncDialog } from '../js/routes/sync/copio-sync-dialog.js';

declare global {
  interface HTMLElementTagNameMap {
    'copio-scanner': CopioScanner;
    'copio-handoff': CopioHandoff;
    'copio-doc-ocr-dialog': CopioDocOcrDialog;
    'copio-sync-dialog': CopioSyncDialog;
  }
}

export {};
