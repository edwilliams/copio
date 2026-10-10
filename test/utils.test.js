import { expect } from '@esm-bundle/chai';
import { randomId } from '../js/utils/utils.js';

describe('utils.js', () => {
  it('randomId should return a 32 character hex string', () => {
    const id = randomId();
    expect(id).to.be.a('string');
    expect(id).to.have.lengthOf(32);
    expect(/^[0-9a-f]{32}$/.test(id)).to.be.true;
  });

  it('randomId should return unique values', () => {
    const id1 = randomId();
    const id2 = randomId();
    expect(id1).to.not.equal(id2);
  });

  function createTestImageDataUrl(width, height, fillStyle = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png');
  }

  it('rotateSrc should swap width and height of an image', async () => {
    const { rotateSrc } = await import('../js/utils/utils.js');
    const originalSrc = createTestImageDataUrl(40, 20);

    const rotatedSrc = await rotateSrc(originalSrc);
    expect(rotatedSrc).to.be.a('string');
    expect(rotatedSrc).to.match(/^data:image\/png/);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = rotatedSrc;
    });

    expect(img.width).to.equal(20);
    expect(img.height).to.equal(40);
  });

  it('thresholdSrc should binarize an image to black/white', async () => {
    const { thresholdSrc } = await import('../js/utils/utils.js');
    const originalSrc = createTestImageDataUrl(30, 30, '#888888');

    const thresholded = await thresholdSrc(originalSrc);
    expect(thresholded).to.be.a('string');
    expect(thresholded).to.match(/^data:image\/png/);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = thresholded;
    });

    expect(img.width).to.equal(30);
    expect(img.height).to.equal(30);
  });

  it('fileToBase64 should convert an image file/blob to a data URL', async () => {
    const { fileToBase64 } = await import('../js/utils/utils.js');
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'test.png', { type: 'image/png' });

    const dataUrl = await fileToBase64(file);
    expect(dataUrl).to.be.a('string');
    expect(dataUrl).to.match(/^data:image\/(png|jpeg)/);
  });
});
