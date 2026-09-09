import { renderPdfPagesToDataUrls } from '../utils/pdf-utils.js';

/**
 * Clean text from markdown formatting and emojis for PDF kit rendering.
 */
function cleanText(txt) {
  if (!txt) return '';
  return txt
    .replace(/✅/g, 'Yes')
    .replace(/❌/g, 'No')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

/**
 * Render raw markdown string into a PDFDocument instance (PDFKit).
 */
export function renderMarkdownToPdf(doc, rawContent) {
  if (!window.marked || !window.marked.lexer) return;
  const tokens = window.marked.lexer(rawContent || '');

  function ensureSpace(neededHeight = 30) {
    if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage({ size: 'A4', margin: 40 });
    }
  }

  doc.addPage({ size: 'A4', margin: 40 });

  for (const token of tokens) {
    if (token.type === 'heading') {
      ensureSpace(40);
      doc.moveDown(0.3);
      const size = token.depth === 1 ? 20 : token.depth === 2 ? 15 : 12;
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#0f172a').text(cleanText(token.text));
      doc.moveDown(0.2);
    } else if (token.type === 'paragraph') {
      const imgToken = token.tokens && token.tokens.find((t) => t.type === 'image');
      if (imgToken && imgToken.href && imgToken.href.startsWith('data:')) {
        try {
          ensureSpace(180);
          doc.moveDown(0.4);
          doc.image(imgToken.href, { fit: [515, 300], align: 'center' });
          doc.moveDown(0.4);
        } catch (e) {
          console.error('Error rendering embedded image to PDF:', e);
        }
      } else {
        ensureSpace(20);
        doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(cleanText(token.text), { lineGap: 3 });
        doc.moveDown(0.4);
      }
    } else if (token.type === 'hr') {
      ensureSpace(15);
      doc.moveDown(0.2);
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);
    } else if (token.type === 'list') {
      for (let i = 0; i < token.items.length; i++) {
        const item = token.items[i];
        ensureSpace(18);
        let bullet = '• ';
        if (token.ordered) bullet = `${i + 1}. `;
        else if (item.task) bullet = item.checked ? '[x] ' : '[ ] ';
        doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(bullet + cleanText(item.text), { indent: 10, lineGap: 2 });
      }
      doc.moveDown(0.4);
    } else if (token.type === 'blockquote') {
      ensureSpace(35);
      const startY = doc.y;
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#475569').text(cleanText(token.text), 50, startY, { width: 495 });
      const endY = doc.y;
      doc.strokeColor('#0284c7').lineWidth(3).moveTo(42, startY).lineTo(42, endY).stroke();
      doc.x = 40;
      doc.moveDown(0.4);
    } else if (token.type === 'code') {
      ensureSpace(50);
      const codeText = token.text;
      const startY = doc.y;
      doc.font('Courier').fontSize(9).fillColor('#0f172a');
      const height = doc.heightOfString(codeText, { width: 495 }) + 16;
      doc.rect(40, startY, 515, height).fill('#f1f5f9');
      doc.fillColor('#0f172a').text(codeText, 50, startY + 8, { width: 495 });
      doc.x = 40;
      doc.y = startY + height + 10;
    } else if (token.type === 'table') {
      ensureSpace(50);
      const cols = token.header.length;
      const colWidth = 515 / cols;
      let startY = doc.y;

      doc.rect(40, startY, 515, 22).fill('#f1f5f9');
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a');
      token.header.forEach((h, idx) => {
        doc.text(cleanText(h.text), 45 + idx * colWidth, startY + 6, { width: colWidth - 10, align: 'left' });
      });
      doc.y = startY + 22;

      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      token.rows.forEach((row, rIdx) => {
        ensureSpace(20);
        const rowY = doc.y;
        if (rIdx % 2 === 1) doc.rect(40, rowY, 515, 20).fill('#f8fafc');
        doc.fillColor('#334155');
        row.forEach((cell, idx) => {
          doc.text(cleanText(cell.text), 45 + idx * colWidth, rowY + 5, { width: colWidth - 10, align: 'left' });
        });
        doc.y = rowY + 20;
      });
      doc.moveDown(0.5);
    }
  }
}

/**
 * Render a markdown page object to image data URLs by rendering PDF and extracting pages as images.
 */
export async function renderMarkdownToPageDataUrls(page) {
  const doc = new PDFDocument({ autoFirstPage: false });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const arrayBufferPromise = new Promise((resolve, reject) => {
    doc.on('end', async () => {
      try {
        const blob = new Blob(chunks, { type: 'application/pdf' });
        const ab = await blob.arrayBuffer();
        resolve(ab);
      } catch (err) {
        reject(err);
      }
    });
    doc.on('error', reject);
  });

  renderMarkdownToPdf(doc, page.content || '');
  doc.end();

  const arrayBuffer = await arrayBufferPromise;
  return renderPdfPagesToDataUrls(arrayBuffer);
}

/**
 * Export document pages as a PDF file download.
 */
export async function exportDocumentAsPdf(docName, pages) {
  if (!pages || pages.length === 0) {
    alert('No images to export');
    return;
  }

  try {
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;

    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    doc.on('end', () => {
      const blob = new Blob(chunks, { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docName || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });

    for (const page of pages) {
      if (page.type === 'markdown') {
        renderMarkdownToPdf(doc, page.content);
      } else {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = (err) => {
            console.warn('Page image failed to load for PDF:', err);
            resolve();
          };
          img.src = page.src;
        });

        if (!img.width || !img.height) continue;

        doc.addPage({ size: 'A4' });

        const scaleX = A4_WIDTH / img.width;
        const scaleY = A4_HEIGHT / img.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        const x = (A4_WIDTH - scaledWidth) / 2;
        const y = (A4_HEIGHT - scaledHeight) / 2;

        doc.image(page.src, x, y, {
          width: scaledWidth,
          height: scaledHeight,
        });
      }
    }

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF');
  }
}

/**
 * Export document pages as individual images or a ZIP file.
 */
export async function exportDocumentAsImages(docName, pages) {
  if (!pages || pages.length === 0) {
    alert('No images to export');
    return;
  }

  try {
    const rawName = (docName || 'document').trim();
    const sanitize = (str) => str.replace(/[/\\?%*:|"<>]/g, '_');
    const safeName = sanitize(rawName) || 'document';

    if (pages.length === 1 && pages[0].type !== 'markdown') {
      const page = pages[0];
      let ext = 'jpg';
      if (page.src.startsWith('data:')) {
        const match = page.src.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        if (match && match[1].includes('png')) ext = 'png';
      }

      let downloadUrl = page.src;
      let shouldRevoke = false;

      if (!page.src.startsWith('data:') && !page.src.startsWith('blob:')) {
        const response = await fetch(page.src);
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${safeName}.${ext}`;
      a.click();
      if (shouldRevoke) URL.revokeObjectURL(downloadUrl);
    } else {
      const zip = new JSZip();
      let exportIdx = 0;

      for (let index = 0; index < pages.length; index++) {
        const page = pages[index];
        let pageDataUrls = [];

        if (page.type === 'markdown') {
          pageDataUrls = await renderMarkdownToPageDataUrls(page);
        } else {
          pageDataUrls = [page.src];
        }

        const padLen = Math.max(2, String(pages.length * pageDataUrls.length).length);

        for (let subIdx = 0; subIdx < pageDataUrls.length; subIdx++) {
          const dataUrl = pageDataUrls[subIdx];
          let ext = 'jpg';
          let base64Data = '';

          if (dataUrl && dataUrl.startsWith('data:')) {
            const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
            if (match) {
              if (match[1].includes('png')) ext = 'png';
              base64Data = match[2];
            } else {
              base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
            }
          } else {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const arrayBuf = await blob.arrayBuffer();
            const pageNum = String(exportIdx + 1).padStart(padLen, '0');
            const fileName = `${safeName}-${pageNum}.${ext}`;
            zip.file(fileName, arrayBuf);
            exportIdx++;
            continue;
          }

          const pageNum = String(exportIdx + 1).padStart(padLen, '0');
          const fileName = `${safeName}-${pageNum}.${ext}`;
          zip.file(fileName, base64Data, { base64: true });
          exportIdx++;
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error downloading images:', error);
    alert('Failed to download images');
  }
}

/**
 * Export markdown pages of a document as a .md file download.
 */
export function exportDocumentAsMarkdown(docName, pages) {
  if (!pages) return;
  const mdPages = pages.filter((p) => p.type === 'markdown');

  if (mdPages.length === 0) {
    alert('No markdown text in this document');
    return;
  }

  const safeName = (docName || 'document').trim().replace(/[/\\?%*:|"<>]/g, '_');

  let content = '';
  if (mdPages.length === 1) {
    content = mdPages[0].content || '';
  } else {
    content = mdPages.map((p, i) => `# Page ${i + 1}: ${p.name || ''}\n\n${p.content || ''}`).join('\n\n---\n\n');
  }

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
