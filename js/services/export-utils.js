import { notify } from './notify.js';
import { loadPdfKit, loadJsZip } from '../utils/module-loader.js';
import {
  isMarkdownPage,
  loadMarkdownParser,
  exportDocumentAsMarkdown,
} from './markdown-module.js';
import {
  renderMarkdownToPdf,
  renderMarkdownToPageDataUrls,
} from './markdown-pdf.js';

export {
  renderMarkdownToPdf,
  renderMarkdownToPageDataUrls,
  exportDocumentAsMarkdown,
};

/**
 * Export document pages as a PDF file download.
 * @param {string} docName
 * @param {Array<any>} pages
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Callback invoked per page: (done, total) => void
 * @param {boolean} [options.showProgress=true] - Whether to show progress toast in UI
 * @param {boolean} [options.download=true] - Whether to trigger browser download
 * @returns {Promise<Blob|undefined>}
 */
export async function exportDocumentAsPdf(docName, pages, options = {}) {
  const { onProgress, showProgress = true, download = true } = options;
  if (!pages || pages.length === 0) {
    notify.warning('No images to export');
    return;
  }

  let progress = null;
  const total = pages.length;

  try {
    if (showProgress && total > 1) {
      progress = await notify.progress({
        message: `Exporting "${docName || 'document'}.pdf"...`,
        total,
        done: 0,
      });
    }

    let downloadToast = null;
    const isFirstPdfLoad = typeof window !== 'undefined' && !window.PDFDocument;
    if (isFirstPdfLoad) {
      if (typeof onProgress === 'function') {
        onProgress(0, total, 'Downloading PDF engine...');
      }
      try {
        downloadToast = await notify.progress({
          message: 'Downloading PDF engine...',
          total: 100,
          done: 0,
        });
      } catch {}
    }

    const hasMarkdown = pages.some(isMarkdownPage);
    let PDFDocument;
    try {
      const [loadedPdfDoc] = await Promise.all([
        loadPdfKit(),
        hasMarkdown ? loadMarkdownParser() : Promise.resolve(),
      ]);
      PDFDocument = loadedPdfDoc;
    } finally {
      downloadToast?.close();
    }

    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;

    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    const exportPromise = new Promise((resolve, reject) => {
      doc.on('end', () => {
        try {
          const blob = new Blob(chunks, { type: 'application/pdf' });
          if (download !== false) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${docName || 'document'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            notify.success(`Exported "${docName || 'document'}.pdf"`);
          }
          progress?.close();
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('copio:export-complete', {
                bubbles: true,
                composed: true,
                detail: {
                  type: 'pdf',
                  format: 'pdf',
                  blob,
                  docName: docName || 'document',
                },
              }),
            );
          }
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      });
      doc.on('error', reject);
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const done = i + 1;

      if (page.type === 'markdown') {
        renderMarkdownToPdf(doc, page.content);
      } else if (page.src || page.blob) {
        const img = new Image();
        let objectUrlToRevoke = null;
        let imgSrc = page.src;
        if (page.blob instanceof Blob && (!imgSrc || imgSrc instanceof Blob)) {
          imgSrc = URL.createObjectURL(page.blob);
          objectUrlToRevoke = imgSrc;
        } else if (page.src instanceof Blob) {
          imgSrc = URL.createObjectURL(page.src);
          objectUrlToRevoke = imgSrc;
        }

        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = (err) => {
            console.warn('Page image failed to load for PDF:', err);
            resolve(undefined);
          };
          img.src = imgSrc;
        });

        if (img.width && img.height) {
          doc.addPage({ size: 'A4' });

          const scaleX = A4_WIDTH / img.width;
          const scaleY = A4_HEIGHT / img.height;
          const scale = Math.min(scaleX, scaleY);

          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;

          const x = (A4_WIDTH - scaledWidth) / 2;
          const y = (A4_HEIGHT - scaledHeight) / 2;

          let imageBuffer = null;
          if (page.blob instanceof Blob) {
            imageBuffer = await page.blob.arrayBuffer();
          } else if (page.src instanceof Blob) {
            imageBuffer = await page.src.arrayBuffer();
          } else if (typeof page.src === 'string' && page.src.startsWith('blob:')) {
            try {
              const resp = await fetch(page.src);
              const b = await resp.blob();
              imageBuffer = await b.arrayBuffer();
            } catch {}
          }

          if (imageBuffer) {
            doc.image(imageBuffer, x, y, {
              width: scaledWidth,
              height: scaledHeight,
            });
          } else {
            doc.image(imgSrc, x, y, {
              width: scaledWidth,
              height: scaledHeight,
            });
          }
        }

        if (objectUrlToRevoke) {
          try {
            URL.revokeObjectURL(objectUrlToRevoke);
          } catch {}
        }
      }

      if (typeof onProgress === 'function') {
        onProgress(done, total);
      }

      if (progress) {
        progress.update({
          done,
          total,
          message: `Exporting PDF: page ${done} of ${total}...`,
        });
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('copio:export-progress', {
            detail: { type: 'pdf', done, total, docName: docName || 'document' },
          }),
        );
      }

      // Yield to browser to keep UI responsive and allow progress re-renders
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    doc.end();
    return await exportPromise;
  } catch (error) {
    progress?.close();
    console.error('Error generating PDF:', error);
    notify.error('Failed to generate PDF');
  }
}

/**
 * Export document pages as individual images or a ZIP file.
 * @param {string} docName
 * @param {Array<any>} pages
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Callback invoked per page: (done, total) => void
 * @param {boolean} [options.showProgress=true] - Whether to show progress toast in UI
 * @param {boolean} [options.download=true] - Whether to trigger browser download
 * @returns {Promise<Blob|undefined>}
 */
export async function exportDocumentAsImages(docName, pages, options = {}) {
  const { onProgress, showProgress = true, download = true } = options;
  if (!pages || pages.length === 0) {
    notify.warning('No images to export');
    return;
  }

  let progress = null;

  try {
    const rawName = (docName || 'document').trim();
    const sanitize = (str) => str.replace(/[/\\?%*:|"<>]/g, '_');
    const safeName = sanitize(rawName) || 'document';

    if (pages.length === 1 && pages[0].type !== 'markdown') {
      const page = pages[0];
      let ext = 'jpg';
      let downloadUrl = '';
      let shouldRevoke = false;
      let exportBlob = null;

      if (page.blob instanceof Blob) {
        exportBlob = page.blob;
        if (exportBlob.type && exportBlob.type.includes('png')) ext = 'png';
        downloadUrl = URL.createObjectURL(exportBlob);
        shouldRevoke = true;
      } else if (page.src instanceof Blob) {
        exportBlob = page.src;
        if (exportBlob.type && exportBlob.type.includes('png')) ext = 'png';
        downloadUrl = URL.createObjectURL(exportBlob);
        shouldRevoke = true;
      } else if (typeof page.src === 'string') {
        downloadUrl = page.src;
        if (page.src.startsWith('data:')) {
          const match = page.src.match(/^data:(image\/[a-zA-Z+]+);base64,/);
          if (match && match[1].includes('png')) ext = 'png';
          try {
            const response = await fetch(page.src);
            exportBlob = await response.blob();
          } catch {
            exportBlob = new Blob([page.src], { type: `image/${ext}` });
          }
        } else if (page.src.startsWith('blob:')) {
          try {
            const response = await fetch(page.src);
            exportBlob = await response.blob();
            if (exportBlob.type && exportBlob.type.includes('png')) ext = 'png';
          } catch {}
        } else {
          try {
            const response = await fetch(page.src);
            exportBlob = await response.blob();
            downloadUrl = URL.createObjectURL(exportBlob);
            shouldRevoke = true;
          } catch {}
        }
      }

      if (typeof onProgress === 'function') {
        onProgress(1, 1);
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('copio:export-progress', {
            detail: { type: 'image', done: 1, total: 1, docName: safeName },
          }),
        );
      }

      if (download !== false) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${safeName}.${ext}`;
        a.click();
        notify.success(`Exported "${safeName}.${ext}"`);
      }
      if (shouldRevoke) URL.revokeObjectURL(downloadUrl);

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('copio:export-complete', {
            bubbles: true,
            composed: true,
            detail: { type: 'image', format: ext, blob: exportBlob, docName: safeName },
          }),
        );
      }
      return exportBlob;
    }

    const total = pages.length;
    if (showProgress && total > 1) {
      progress = await notify.progress({
        message: `Exporting "${safeName}.zip"...`,
        total,
        done: 0,
      });
    }

    const hasMarkdown = pages.some(isMarkdownPage);
    const [JSZip] = await Promise.all([
      loadJsZip(),
      hasMarkdown ? Promise.all([loadPdfKit(), loadMarkdownParser()]) : Promise.resolve(),
    ]);
    const zip = new JSZip();
    let exportIdx = 0;

    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      let pageDataUrls = [];

      if (page.type === 'markdown') {
        pageDataUrls = await renderMarkdownToPageDataUrls(page);
      } else {
        pageDataUrls = [page.blob || page.src];
      }

      const padLen = Math.max(2, String(pages.length * pageDataUrls.length).length);

      for (let subIdx = 0; subIdx < pageDataUrls.length; subIdx++) {
        const item = pageDataUrls[subIdx];
        let ext = 'jpg';
        let arrayBuf = null;

        if (item instanceof Blob) {
          if (item.type && item.type.includes('png')) ext = 'png';
          arrayBuf = await item.arrayBuffer();
        } else if (typeof item === 'string' && item.startsWith('data:')) {
          const match = item.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
          let base64Data = '';
          if (match) {
            if (match[1].includes('png')) ext = 'png';
            base64Data = match[2];
          } else {
            base64Data = item.replace(/^data:[^;]+;base64,/, '');
          }
          const pageNum = String(exportIdx + 1).padStart(padLen, '0');
          const fileName = `${safeName}-${pageNum}.${ext}`;
          zip.file(fileName, base64Data, { base64: true });
          exportIdx++;
          continue;
        } else if (typeof item === 'string') {
          try {
            const response = await fetch(item);
            const blob = await response.blob();
            if (blob.type && blob.type.includes('png')) ext = 'png';
            arrayBuf = await blob.arrayBuffer();
          } catch {}
        }

        if (arrayBuf) {
          const pageNum = String(exportIdx + 1).padStart(padLen, '0');
          const fileName = `${safeName}-${pageNum}.${ext}`;
          zip.file(fileName, arrayBuf);
          exportIdx++;
        }
      }

      const done = index + 1;
      if (typeof onProgress === 'function') {
        onProgress(done, total);
      }

      if (progress) {
        progress.update({
          done,
          total,
          message: `Exporting ZIP: page ${done} of ${total}...`,
        });
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('copio:export-progress', {
            detail: { type: 'zip', done, total, docName: safeName },
          }),
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (progress) {
      progress.update({ message: 'Compressing archive...' });
    }

    const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      if (progress && metadata.percent) {
        progress.update({
          value: Math.round(metadata.percent),
          message: `Compressing ZIP: ${Math.round(metadata.percent)}%...`,
        });
      }
    });

    if (download !== false) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      notify.success(`Exported "${safeName}.zip"`);
    }
    progress?.close();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('copio:export-complete', {
          bubbles: true,
          composed: true,
          detail: { type: 'zip', format: 'zip', blob, docName: safeName },
        }),
      );
    }
    return blob;
  } catch (error) {
    progress?.close();
    console.error('Error downloading images:', error);
    notify.error('Failed to download images');
  }
}
