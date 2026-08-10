import exifr from './lib/exifr.js';

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
 */
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

