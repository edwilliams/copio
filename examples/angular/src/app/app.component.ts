import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import '@copio/sdk/scanner';
import { COPIO_EVENTS, type CopioScanner } from '@copio/sdk/scanner';
import { registerService } from '@copio/sdk/core';

registerService('pdf', {
  exportDocumentAsPdf: async (
    docName: string,
    pages: Array<{ src: string }>,
    options?: Record<string, unknown>,
  ) => {
    const exportUrl = ['/copio-sdk', 'export.js'].join('/');
    const mod = await import(/* @vite-ignore */ exportUrl);
    return mod.exportDocumentAsPdf(docName, pages, options);
  },
});

@Component({
  selector: 'app-root',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main class="app">
      <header class="header">
        <h1>Copio SDK — Angular 19</h1>
        <p class="status">{{ status }}</p>
      </header>

      <div class="scanner-box">
        <copio-scanner
          #scanner
          mode="batch"
          aspect="a4"
          theme="dark"
          asset-base="/copio-sdk"
        ></copio-scanner>
      </div>

      <div class="actions">
        <button type="button" [disabled]="exporting" (click)="exportPdf()">
          {{ exporting ? 'Exporting...' : 'Export PDF' }}
        </button>
      </div>
    </main>
  `,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scanner', { static: true }) scannerRef!: ElementRef<CopioScanner>;

  status = 'Capture or import a page, then click Done or Export PDF.';
  exporting = false;

  private readonly handleScanComplete = (event: Event): void => {
    const { pageCount, pages } = (event as CustomEvent<{ pageCount: number; pages: unknown[] }>).detail;
    this.status = `Scan complete: ${pageCount} page(s) ready.`;
    console.log('copio:scan-complete', pages);
  };

  ngAfterViewInit(): void {
    this.scannerRef.nativeElement.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, this.handleScanComplete);
  }

  ngOnDestroy(): void {
    this.scannerRef.nativeElement.removeEventListener(COPIO_EVENTS.SCAN_COMPLETE, this.handleScanComplete);
  }

  async exportPdf(): Promise<void> {
    const scanner = this.scannerRef.nativeElement;
    const pages = await scanner.getPages();
    if (!pages.length) {
      this.status = 'Capture or import at least one page before exporting.';
      return;
    }

    this.exporting = true;
    this.status = 'Exporting PDF...';
    try {
      await scanner.exportPdf({ docName: 'angular-scan', download: true });
      this.status = `Exported ${pages.length} page(s) to angular-scan.pdf.`;
    } finally {
      this.exporting = false;
    }
  }
}
