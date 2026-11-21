import '@copio/sdk';
import { COPIO_EVENTS, setAssetBase } from '@copio/sdk';
import './style.css';

setAssetBase('/copio-sdk');

const scanner = document.getElementById('scanner');
const statusEl = document.getElementById('status');
const exportBtn = document.getElementById('export-btn');

scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (event) => {
  const { pageCount, pages } = event.detail;
  statusEl.textContent = `Scan complete: ${pageCount} page(s) ready.`;
  console.log('copio:scan-complete', pages);
});

exportBtn.addEventListener('click', async () => {
  const pages = await scanner.getPages();
  if (!pages.length) {
    statusEl.textContent = 'Capture or import at least one page before exporting.';
    return;
  }

  exportBtn.disabled = true;
  statusEl.textContent = 'Exporting PDF...';
  try {
    await scanner.exportPdf({ docName: 'vanilla-scan', download: true });
    statusEl.textContent = `Exported ${pages.length} page(s) to vanilla-scan.pdf.`;
  } finally {
    exportBtn.disabled = false;
  }
});
