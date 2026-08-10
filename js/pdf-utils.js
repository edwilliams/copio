import * as pdfjsLib from './lib/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './js/lib/pdf.worker.min.mjs';

/**
 * Renders all pages of a PDF (given as ArrayBuffer) into base64 JPEG image data URLs.
 * @param {ArrayBuffer} arrayBuffer 
 * @param {number} scale 
 * @returns {Promise<string[]>} Array of image data URLs
 */
export async function renderPdfPagesToDataUrls(arrayBuffer, scale = 2.0) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    images.push(canvas.toDataURL('image/jpeg', 0.82));
  }

  return images;
}
