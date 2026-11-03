/**
 * Markdown to PDF Rendering (CPO-026)
 * 
 * Compiles markdown tokens to PDFKit Document and renders markdown pages
 * to image data URLs. Kept separate from core markdown UI to avoid bloating
 * scanner bundles.
 */
import { loadPdfKit } from '../utils/module-loader.js';
import { loadMarkdownParser, cleanText } from './markdown-module.js';

export { cleanText };

/**
 * Render raw markdown string into a PDFDocument instance (PDFKit).
 * @param {any} doc - PDFDocument instance
 * @param {string} rawContent
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
      const startY = doc.y;

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
 * @param {Object} page
 * @returns {Promise<string[]>}
 */
export async function renderMarkdownToPageDataUrls(page) {
  const [PDFDocument] = await Promise.all([
    loadPdfKit(),
    loadMarkdownParser(),
  ]);
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

  const pdfArrayBuffer = await arrayBufferPromise;
  const { renderPdfPagesToDataUrls } = await import('../utils/pdf-utils.js');
  return renderPdfPagesToDataUrls(pdfArrayBuffer);
}
