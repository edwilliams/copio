import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import Sortable from '../js/lib/sortable.esm.js';

function createTestImageDataUrl(width = 40, height = 20, color = '#ff0000') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
}

async function createTestImageFile(name = 'sample.png', width = 30, height = 30, color = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}

function createMultiPagePdfFile(pageCount = 2) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const blob = new Blob(chunks, { type: 'application/pdf' });
      resolve(new File([blob], 'multipage-document.pdf', { type: 'application/pdf' }));
    });
    doc.on('error', reject);
    for (let i = 1; i <= pageCount; i++) {
      doc.addPage();
      doc.text(`Testing Page Number ${i}`);
    }
    doc.end();
  });
}

function waitForImageLoad(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function waitFor(predicate, timeoutMs = 5000, errorMsg = 'Condition timed out') {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      try {
        if (predicate()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error(errorMsg));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 20);
  });
}

describe('Page Operations & Editing', function () {
  this.timeout(10000);
  let imagesEl;

  beforeEach(async () => {
    imagesEl = document.createElement('copio-images');
    document.body.appendChild(imagesEl);
    await customElements.whenDefined('copio-images');
  });

  afterEach(() => {
    imagesEl?.remove();
  });

  it('Image upload: adds a single image file via file input', async () => {
    const file = await createTestImageFile('receipt.png', 40, 40, '#22c55e');
    const fileInput = imagesEl.shadowRoot.querySelector('input[type="file"]');

    // Simulate input change
    fileInput.onchange({ target: { files: [file] } });

    // Wait for async processing
    await waitFor(
      () => imagesEl.images.length === 1,
      5000,
      'Single image upload via input did not populate images array within 5000ms',
    );

    expect(imagesEl.images).to.have.lengthOf(1);
    expect(imagesEl.images[0].src).to.match(/^data:image\/png/);
    expect(imagesEl.images[0].id).to.be.a('string');

    // DOM check
    const wrappers = imagesEl.shadowRoot.querySelectorAll('.image-wrapper');
    expect(wrappers.length).to.equal(1);
    const img = wrappers[0].querySelector('img');
    expect(img).to.exist;
    expect(img.getAttribute('src')).to.equal(imagesEl.images[0].src);
  });

  it('Image upload: adds multiple image files in a single selection', async () => {
    const file1 = await createTestImageFile('page1.png', 30, 30, '#ef4444');
    const file2 = await createTestImageFile('page2.png', 30, 30, '#3b82f6');
    const fileInput = imagesEl.shadowRoot.querySelector('input[type="file"]');

    fileInput.onchange({ target: { files: [file1, file2] } });

    await waitFor(
      () => imagesEl.images.length === 2,
      5000,
      'Multiple image upload did not populate 2 images within 5000ms',
    );

    expect(imagesEl.images).to.have.lengthOf(2);
    expect(imagesEl.images[0].id).to.not.equal(imagesEl.images[1].id);
    expect(imagesEl.shadowRoot.querySelectorAll('.image-wrapper')).to.have.lengthOf(2);
  });

  it('Image upload: adds image file via drag-and-drop onto the container', async function () {
    this.timeout(10000);
    const file = await createTestImageFile('dropped-doc.png', 50, 50, '#eab308');
    const container = imagesEl.shadowRoot.querySelector('.container');

    const dropEvent = new CustomEvent('drop', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { files: [file] },
    });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        types: ['Files'],
        files: [file],
      },
      configurable: true,
      writable: true,
    });

    container.dispatchEvent(dropEvent);

    await waitFor(
      () => imagesEl.images.length === 1,
      5000,
      'Drag and drop upload did not populate images array within 5000ms',
    );

    expect(imagesEl.images).to.have.lengthOf(1);
    expect(imagesEl.shadowRoot.querySelectorAll('.image-wrapper')).to.have.lengthOf(1);
  });

  it('PDF document import: renders each page of a multi-page PDF as an image', async () => {
    const pdfFile = await createMultiPagePdfFile(2);
    const fileInput = imagesEl.shadowRoot.querySelector('input[type="file"]');

    fileInput.onchange({ target: { files: [pdfFile] } });

    await waitFor(
      () => imagesEl.images.length === 2,
      5000,
      'PDF import did not populate 2 images within 5000ms',
    );

    expect(imagesEl.images).to.have.lengthOf(2);
    expect(imagesEl.images[0].src).to.match(/^data:image\/jpeg/);
    expect(imagesEl.images[1].src).to.match(/^data:image\/jpeg/);
    expect(imagesEl.images[0].id).to.not.equal(imagesEl.images[1].id);
    expect(imagesEl.shadowRoot.querySelectorAll('.image-wrapper')).to.have.lengthOf(2);
  });

  it('Cropping: updates page image data URL when crop is applied', async () => {
    const originalSrc = createTestImageDataUrl(100, 100, '#a855f7');
    imagesEl.images = [{ id: 'crop-test-page', src: originalSrc }];

    const cropImage = imagesEl.shadowRoot.querySelector('#crop-image');
    imagesEl.openCropDialog(0);

    // Wait for cropper initialization
    await waitFor(
      () => imagesEl.shadowRoot.querySelector('.cropper-container'),
      5000,
      'Cropper container did not initialize within 5000ms',
    );

    expect(imagesEl.shadowRoot.querySelector('.cropper-container')).to.exist;

    // Apply crop
    imagesEl.applyCrop();

    const croppedSrc = imagesEl.images[0].src;
    expect(croppedSrc).to.be.a('string');
    expect(croppedSrc).to.match(/^data:image\/png/);

    // Crop dialog should be closed
    const cropDialog = imagesEl.shadowRoot.querySelector('.crop-dialog');
    expect(cropDialog.open).to.be.false;
  });

  it('Rotation: rotating 90° swaps orientation and updates image data', async () => {
    // 40 wide, 20 high
    const originalSrc = createTestImageDataUrl(40, 20, '#06b6d4');
    imagesEl.images = [{ id: 'rotate-test-page', src: originalSrc }];

    await imagesEl.rotateImage(0);

    const rotatedSrc = imagesEl.images[0].src;
    expect(rotatedSrc).to.be.a('string');
    expect(rotatedSrc).to.not.equal(originalSrc);

    const img = await waitForImageLoad(rotatedSrc);
    // After 90° clockwise rotation: width and height are swapped
    expect(img.width).to.equal(20);
    expect(img.height).to.equal(40);
  });

  it('Black & White: applies Sauvola threshold filter and binarizes image', async () => {
    // Gray image with #888888
    const originalSrc = createTestImageDataUrl(30, 30, '#888888');
    imagesEl.images = [{ id: 'threshold-test-page', src: originalSrc }];

    await imagesEl.thresholdImage(0);

    const thresholdedSrc = imagesEl.images[0].src;
    expect(thresholdedSrc).to.be.a('string');
    expect(thresholdedSrc).to.not.equal(originalSrc);

    const img = await waitForImageLoad(thresholdedSrc);
    expect(img.width).to.equal(30);
    expect(img.height).to.equal(30);

    // Verify binarization: check pixels are either 0 or 255
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, 30, 30).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      expect(r === 0 || r === 255).to.be.true;
      expect(g === 0 || g === 255).to.be.true;
      expect(b === 0 || b === 255).to.be.true;
    }
  });

  it('Page reordering: Sortable moves items and updates array sequence', async () => {
    imagesEl.images = [
      { id: 'page-A', src: createTestImageDataUrl(10, 10, '#111') },
      { id: 'page-B', src: createTestImageDataUrl(10, 10, '#222') },
      { id: 'page-C', src: createTestImageDataUrl(10, 10, '#333') },
    ];

    const container = imagesEl.shadowRoot.querySelector('.container');
    const sortable = Sortable.get(container);
    expect(sortable).to.exist;

    // Simulate moving page-A (index 0) to end (index 2)
    sortable.options.onEnd({
      to: container,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
    });

    const pageOrder = imagesEl.images.map((p) => p.id);
    expect(pageOrder).to.deep.equal(['page-B', 'page-C', 'page-A']);

    // Grid DOM should reflect new order
    const renderedWrappers = imagesEl.shadowRoot.querySelectorAll('.image-wrapper');
    expect(renderedWrappers).to.have.lengthOf(3);
  });

  it('Page deletion: removes specific page, updates count and retains remaining pages', async () => {
    imagesEl.images = [
      { id: 'page-1', src: createTestImageDataUrl(10, 10, '#111') },
      { id: 'page-2', src: createTestImageDataUrl(10, 10, '#222') },
      { id: 'page-3', src: createTestImageDataUrl(10, 10, '#333') },
    ];

    expect(imagesEl.images).to.have.lengthOf(3);

    // Delete middle page (index 1) via dropdown menu selection
    const menus = imagesEl.shadowRoot.querySelectorAll('.image-menu');
    const middleMenu = menus[1].querySelector('sl-menu');
    middleMenu.dispatchEvent(
      new CustomEvent('sl-select', {
        bubbles: true,
        composed: true,
        detail: { item: { value: 'delete' } },
      }),
    );

    expect(imagesEl.images).to.have.lengthOf(2);
    expect(imagesEl.images.map((p) => p.id)).to.deep.equal(['page-1', 'page-3']);

    const remainingWrappers = imagesEl.shadowRoot.querySelectorAll('.image-wrapper');
    expect(remainingWrappers).to.have.lengthOf(2);
  });
});
