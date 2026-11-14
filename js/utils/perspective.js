// SPDX-License-Identifier: AGPL-3.0
/**
 * Perspective Correction & Homography Warp (CPO-075)
 *
 * Pure JS 4-point projective homography and bilinear image warp
 * with zero external dependencies.
 */

/**
 * @typedef {{ x: number, y: number }} Point2D
 * @typedef {{ topLeft: Point2D, topRight: Point2D, bottomRight: Point2D, bottomLeft: Point2D }} Quad2D
 */

/**
 * Computes target rectangular dimensions (in pixels) for a pixel-space quadrilateral.
 * Uses the maximum of opposite edge lengths so no detail is lost on the closer edge.
 * @param {Quad2D} pixelQuad
 * @returns {{ width: number, height: number }}
 */
export function computeQuadDimensions(pixelQuad) {
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = pixelQuad;
  const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);

  return {
    width: Math.max(1, Math.round(Math.max(widthTop, widthBottom))),
    height: Math.max(1, Math.round(Math.max(heightLeft, heightRight))),
  };
}

/**
 * Solves the projective homography mapping unit square (u, v) in [0, 1]^2
 * to source pixel coordinates (x, y) inside `pixelQuad`:
 *   x = (a*u + b*v + c) / (g*u + h*v + 1)
 *   y = (d*u + e*v + f) / (g*u + h*v + 1)
 *
 * @param {Quad2D} pixelQuad
 * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number }}
 */
export function solveUnitSquareHomography(pixelQuad) {
  const x0 = pixelQuad.topLeft.x;
  const y0 = pixelQuad.topLeft.y;
  const x1 = pixelQuad.topRight.x;
  const y1 = pixelQuad.topRight.y;
  const x2 = pixelQuad.bottomRight.x;
  const y2 = pixelQuad.bottomRight.y;
  const x3 = pixelQuad.bottomLeft.x;
  const y3 = pixelQuad.bottomLeft.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;

  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  const det = dx1 * dy2 - dx2 * dy1;
  let g = 0;
  let h = 0;
  if (Math.abs(det) > 1e-12) {
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }

  return {
    a: x1 - x0 + g * x1,
    b: x3 - x0 + h * x3,
    c: x0,
    d: y1 - y0 + g * y1,
    e: y3 - y0 + h * y3,
    f: y0,
    g,
    h,
  };
}

/**
 * Warps a source RGBA pixel buffer using inverse homography and bilinear interpolation.
 *
 * @param {Uint8ClampedArray} srcData
 * @param {number} srcW
 * @param {number} srcH
 * @param {Quad2D} pixelQuad
 * @param {number} outW
 * @param {number} outH
 * @returns {Uint8ClampedArray}
 */
export function warpPerspectivePixels(srcData, srcW, srcH, pixelQuad, outW, outH) {
  const dstData = new Uint8ClampedArray(outW * outH * 4);
  const { a, b, c, d, e, f, g, h } = solveUnitSquareHomography(pixelQuad);
  const maxX = srcW - 1;
  const maxY = srcH - 1;

  for (let dy = 0; dy < outH; dy++) {
    const v = (dy + 0.5) / outH;
    const bv = b * v + c;
    const ev = e * v + f;
    const hv = h * v + 1;

    for (let dx = 0; dx < outW; dx++) {
      const u = (dx + 0.5) / outW;
      const denom = g * u + hv;
      if (Math.abs(denom) < 1e-12) continue;

      // Convert continuous pixel coordinate to 0-indexed pixel center
      let sx = (a * u + bv) / denom - 0.5;
      let sy = (d * u + ev) / denom - 0.5;

      if (sx < 0) sx = 0;
      else if (sx > maxX) sx = maxX;
      if (sy < 0) sy = 0;
      else if (sy > maxY) sy = maxY;

      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = x0 < maxX ? x0 + 1 : maxX;
      const y1 = y0 < maxY ? y0 + 1 : maxY;
      const fx = sx - x0;
      const fy = sy - y0;
      const ifx = 1 - fx;
      const ify = 1 - fy;

      const w00 = ifx * ify;
      const w10 = fx * ify;
      const w01 = ifx * fy;
      const w11 = fx * fy;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const dstIdx = (dy * outW + dx) * 4;
      dstData[dstIdx] = Math.round(srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11);
      dstData[dstIdx + 1] = Math.round(srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11);
      dstData[dstIdx + 2] = Math.round(srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11);
      dstData[dstIdx + 3] = Math.round(srcData[i00 + 3] * w00 + srcData[i10 + 3] * w10 + srcData[i01 + 3] * w01 + srcData[i11 + 3] * w11);
    }
  }

  return dstData;
}

/**
 * Performs 4-point perspective warp on an HTMLImageElement or HTMLCanvasElement
 * using normalized [0, 1] quadrilateral coordinates.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imgOrCanvas
 * @param {Quad2D} normalizedQuad
 * @returns {HTMLCanvasElement}
 */
export function warpPerspectiveToCanvas(imgOrCanvas, normalizedQuad) {
  const srcW = /** @type {any} */ (imgOrCanvas).naturalWidth || imgOrCanvas.width || 0;
  const srcH = /** @type {any} */ (imgOrCanvas).naturalHeight || imgOrCanvas.height || 0;
  if (srcW <= 0 || srcH <= 0) {
    const empty = document.createElement('canvas');
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  let srcCanvas;
  if (typeof HTMLCanvasElement !== 'undefined' && imgOrCanvas instanceof HTMLCanvasElement) {
    srcCanvas = imgOrCanvas;
  } else {
    srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    const sCtx = srcCanvas.getContext('2d');
    sCtx.drawImage(imgOrCanvas, 0, 0, srcW, srcH);
  }

  const sCtx = srcCanvas.getContext('2d');
  const srcImageData = sCtx.getImageData(0, 0, srcW, srcH);

  const pixelQuad = {
    topLeft: { x: normalizedQuad.topLeft.x * srcW, y: normalizedQuad.topLeft.y * srcH },
    topRight: { x: normalizedQuad.topRight.x * srcW, y: normalizedQuad.topRight.y * srcH },
    bottomRight: { x: normalizedQuad.bottomRight.x * srcW, y: normalizedQuad.bottomRight.y * srcH },
    bottomLeft: { x: normalizedQuad.bottomLeft.x * srcW, y: normalizedQuad.bottomLeft.y * srcH },
  };

  const { width: outW, height: outH } = computeQuadDimensions(pixelQuad);
  const warpedPixels = warpPerspectivePixels(srcImageData.data, srcW, srcH, pixelQuad, outW, outH);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  const outImageData = outCtx.createImageData(outW, outH);
  outImageData.data.set(warpedPixels);
  outCtx.putImageData(outImageData, 0, 0);

  return outCanvas;
}
