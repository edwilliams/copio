import exifr from './exifr.js';

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
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(format, 0.92);
}

export function thresholdSrc(src) {
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
      const gray = new Uint8Array(width * height);
      for (let i = 0; i < gray.length; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        gray[i] = (r * 77 + g * 150 + b * 29) >> 8;
      }
      const size = 15;
      const half = Math.floor(size / 2);
      const compensation = 7;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0, count = 0;
          for (let dy = -half; dy <= half; dy++) {
            for (let dx = -half; dx <= half; dx++) {
              const nx = Math.min(width - 1, Math.max(0, x + dx));
              const ny = Math.min(height - 1, Math.max(0, y + dy));
              sum += gray[ny * width + nx];
              count++;
            }
          }
          const mean = sum / count;
          const val = gray[y * width + x] < mean - compensation ? 0 : 255;
          const idx = (y * width + x) * 4;
          data[idx] = data[idx + 1] = data[idx + 2] = val;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
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
      resolve(canvas.toDataURL());
    };
    img.src = src;
  });
}
