import exifr from '../lib/exifr.js';

export async function extractExif(file) {
  try {
    return await exifr.parse(file) || null;
  } catch {
    return null;
  }
}

export function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export async function fileToBase64(file) {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    if (file && typeof file.arrayBuffer === 'function') {
      const buf = await file.arrayBuffer();
      const bufCtor = /** @type {any} */ (globalThis).Buffer;
      const b64 = typeof bufCtor !== 'undefined'
        ? bufCtor.from(buf).toString('base64')
        : btoa(String.fromCharCode(...new Uint8Array(buf)));
      const mime = file.type || 'image/png';
      return `data:${mime};base64,${b64}`;
    }
    if (typeof file === 'string') return file;
  }

  const bitmap = await createImageBitmap(file);
  const MAX_W = 1654;
  const MAX_H = 2339;
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);

  // If image already fits max dimensions and is a standard web image, preserve original file bytes
  if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png' || file.type === 'image/webp')) {
    bitmap.close();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(format, format === 'image/png' ? undefined : 0.82);
}

/**
 * Local adaptive document binarization using the Sauvola algorithm (from Doxa framework)
 * Optimized using 2D Integral Images for O(W * H) linear time execution.
 * 
 * @param {ImageData} imageData 
 * @param {number} [windowSize=21] 
 * @param {number} [k=0.2] 
 * @param {number} [R=128] 
 * @returns {ImageData}
 */
export function applySauvolaToImageData(imageData, windowSize = 21, k = 0.2, R = 128) {
  const { data, width, height } = imageData;

  const stride = width + 1;
  const sum = new Float64Array((width + 1) * (height + 1));
  const sqSum = new Float64Array((width + 1) * (height + 1));
  const gray = new Uint8Array(width * height);

  // Build integral image & integral squared image
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSqSum = 0;
    const rowIdx = y * width;
    const sumRowIdx = (y + 1) * stride;
    const prevSumRowIdx = y * stride;

    for (let x = 0; x < width; x++) {
      const idx = (rowIdx + x) * 4;
      const g = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
      gray[rowIdx + x] = g;

      rowSum += g;
      rowSqSum += g * g;

      sum[sumRowIdx + x + 1] = sum[prevSumRowIdx + x + 1] + rowSum;
      sqSum[sumRowIdx + x + 1] = sqSum[prevSumRowIdx + x + 1] + rowSqSum;
    }
  }

  // Sauvola local window adaptive thresholding
  const half = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(height - 1, y + half);
    const y1Str = y1 * stride;
    const y2Str = (y2 + 1) * stride;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(width - 1, x + half);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const areaSum = sum[y2Str + x2 + 1] - sum[y1Str + x2 + 1] - sum[y2Str + x1] + sum[y1Str + x1];
      const areaSqSum = sqSum[y2Str + x2 + 1] - sqSum[y1Str + x2 + 1] - sqSum[y2Str + x1] + sqSum[y1Str + x1];

      const mean = areaSum / count;
      const variance = Math.max(0, (areaSqSum / count) - (mean * mean));
      const stdDev = Math.sqrt(variance);

      const threshold = mean * (1 + k * ((stdDev / R) - 1));

      const pIdx = y * width + x;
      const pixelVal = gray[pIdx] < threshold ? 0 : 255;

      const dataIdx = pIdx * 4;
      data[dataIdx] = pixelVal;
      data[dataIdx + 1] = pixelVal;
      data[dataIdx + 2] = pixelVal;
    }
  }

  return imageData;
}

export function thresholdSrc(src, windowSize = 21, k = 0.2, R = 128) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applySauvolaToImageData(imageData, windowSize, k, R);
      ctx.putImageData(imageData, 0, 0);

      const isPng = src.startsWith('data:image/png');
      const format = isPng ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(format, isPng ? undefined : 0.82));
    };
    img.src = src;
  });
}

export function rotateSrc(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const isPng = src.startsWith('data:image/png');
      const format = isPng ? 'image/png' : 'image/jpeg';
      resolve(canvas.toDataURL(format, isPng ? undefined : 0.82));
    };
    img.src = src;
  });
}

export function getCroppedSrc(cropper, originalSrc = '') {
  if (!cropper) return '';
  const canvas = cropper.getCroppedCanvas();
  const isPng = originalSrc.startsWith('data:image/png');
  const format = isPng ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(format, isPng ? undefined : 0.82);
}

/**
 * Normalizes an edit stack object.
 * @param {Object} [edits]
 * @returns {{ crop: { x: number, y: number, width: number, height: number } | null, rotation: number, filter: string }}
 */
export function normalizeEdits(edits) {
  if (!edits || typeof edits !== 'object') {
    return { crop: null, rotation: 0, filter: 'none' };
  }
  const crop = (edits.crop && typeof edits.crop === 'object' && edits.crop.width > 0 && edits.crop.height > 0)
    ? {
        x: Math.round(edits.crop.x || 0),
        y: Math.round(edits.crop.y || 0),
        width: Math.round(edits.crop.width),
        height: Math.round(edits.crop.height),
      }
    : null;
  const rotation = ((Math.round(edits.rotation || 0) % 360) + 360) % 360;
  const filter = (edits.filter === 'bw') ? 'bw' : 'none';
  return { crop, rotation, filter };
}

/**
 * Checks whether an edit stack contains any active transformations.
 * @param {Object} [edits]
 * @returns {boolean}
 */
export function hasActiveEdits(edits) {
  if (!edits) return false;
  const n = normalizeEdits(edits);
  return !!(n.crop || n.rotation !== 0 || n.filter !== 'none');
}

/**
 * Renders an image or canvas through the edit stack synchronously onto a new canvas.
 * @param {HTMLImageElement|HTMLCanvasElement} imgOrCanvas
 * @param {Object} [edits]
 * @returns {HTMLCanvasElement}
 */
export function renderEditsToCanvas(imgOrCanvas, edits) {
  const norm = normalizeEdits(edits);
  const srcWidth = /** @type {any} */ (imgOrCanvas).naturalWidth || imgOrCanvas.width || 0;
  const srcHeight = /** @type {any} */ (imgOrCanvas).naturalHeight || imgOrCanvas.height || 0;

  // 1. Crop
  let cropCanvas = document.createElement('canvas');
  let cWidth = srcWidth;
  let cHeight = srcHeight;
  let cropX = 0;
  let cropY = 0;

  if (norm.crop) {
    cropX = Math.max(0, Math.min(norm.crop.x, srcWidth));
    cropY = Math.max(0, Math.min(norm.crop.y, srcHeight));
    cWidth = Math.max(1, Math.min(norm.crop.width, srcWidth - cropX));
    cHeight = Math.max(1, Math.min(norm.crop.height, srcHeight - cropY));
  }

  cropCanvas.width = cWidth;
  cropCanvas.height = cHeight;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(imgOrCanvas, cropX, cropY, cWidth, cHeight, 0, 0, cWidth, cHeight);

  // 2. Rotate
  let workingCanvas = cropCanvas;
  if (norm.rotation !== 0) {
    const rot = norm.rotation;
    const rotCanvas = document.createElement('canvas');
    if (rot === 90 || rot === 270) {
      rotCanvas.width = workingCanvas.height;
      rotCanvas.height = workingCanvas.width;
    } else {
      rotCanvas.width = workingCanvas.width;
      rotCanvas.height = workingCanvas.height;
    }
    const rCtx = rotCanvas.getContext('2d');
    rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rCtx.rotate((rot * Math.PI) / 180);
    rCtx.drawImage(workingCanvas, -workingCanvas.width / 2, -workingCanvas.height / 2);
    workingCanvas = rotCanvas;
  }

  // 3. Filter
  if (norm.filter === 'bw') {
    const wCtx = workingCanvas.getContext('2d');
    const imgData = wCtx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
    applySauvolaToImageData(imgData);
    wCtx.putImageData(imgData, 0, 0);
  }

  return workingCanvas;
}

/**
 * Applies non-destructive edits to an original image src.
 * Resolves to the derived data URL.
 * 
 * @param {string} originalSrc
 * @param {Object} [edits]
 * @returns {Promise<string>}
 */
export function applyEdits(originalSrc, edits) {
  if (!originalSrc) return Promise.resolve('');
  const norm = normalizeEdits(edits);
  if (!hasActiveEdits(norm)) {
    return Promise.resolve(originalSrc);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const isPng = originalSrc.startsWith('data:image/png');
        const format = isPng ? 'image/png' : 'image/jpeg';
        const canvas = renderEditsToCanvas(img, norm);
        resolve(canvas.toDataURL(format, isPng ? undefined : 0.82));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = originalSrc;
  });
}


