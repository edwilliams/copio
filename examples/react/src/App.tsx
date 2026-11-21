import { useEffect, useRef, useState } from 'react';
import '@copio/sdk';
import { COPIO_EVENTS, setAssetBase, type CopioScanner } from '@copio/sdk';

setAssetBase('/copio-sdk');

export function App() {
  const scannerRef = useRef<CopioScanner | null>(null);
  const [status, setStatus] = useState('Capture or import a page, then click Done or Export PDF.');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    const handleScanComplete = (event: Event) => {
      const { pageCount, pages } = (event as CustomEvent<{ pageCount: number; pages: unknown[] }>).detail;
      setStatus(`Scan complete: ${pageCount} page(s) ready.`);
      console.log('copio:scan-complete', pages);
    };

    scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, handleScanComplete);
    return () => scanner.removeEventListener(COPIO_EVENTS.SCAN_COMPLETE, handleScanComplete);
  }, []);

  async function handleExportPdf() {
    const scanner = scannerRef.current;
    if (!scanner) return;

    const pages = await scanner.getPages();
    if (!pages.length) {
      setStatus('Capture or import at least one page before exporting.');
      return;
    }

    setExporting(true);
    setStatus('Exporting PDF...');
    try {
      await scanner.exportPdf({ docName: 'react-scan', download: true });
      setStatus(`Exported ${pages.length} page(s) to react-scan.pdf.`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Copio SDK — React 19</h1>
        <p className="status">{status}</p>
      </header>

      <div className="scanner-box">
        <copio-scanner ref={scannerRef} mode="batch" aspect="a4" theme="dark" />
      </div>

      <div className="actions">
        <button type="button" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>
    </main>
  );
}
export default App;
