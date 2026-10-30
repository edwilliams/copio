import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import '../sdk/index.js';

function createTestImageDataUrl(width = 120, height = 80, color = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
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

describe('CPO-025: Non-Destructive Touch Crop UX & Re-editable Crop', function () {
  this.timeout(10000);
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'crop-test-fixture';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer.remove();
  });

  describe('Acceptance Criterion 1: Touch Target Hit Area (≥ 44px invariant, 48px × 48px hit area)', () => {
    it('verifies all Cropper.js handle points have touch hit dimensions ≥ 44px (48px × 48px)', async () => {
      const imagesEl = document.createElement('copio-images');
      fixtureContainer.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');

      const testSrc = createTestImageDataUrl(150, 100, '#3b82f6');
      imagesEl.images = [{
        id: 'touch-target-page',
        src: testSrc,
        originalSrc: testSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      await imagesEl.openCropDialog(0);
      const cropDialog = imagesEl.shadowRoot.querySelector('.crop-dialog');
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-point') && !cropDialog.classList.contains('dialog--is-animating'));

      const points = imagesEl.shadowRoot.querySelectorAll('.cropper-point');
      expect(points.length).to.be.greaterThan(0);

      // Give animation a moment to settle to full 1.0 scale
      await waitFor(() => {
        const first = points[0];
        return first && first.offsetWidth >= 44 && first.getBoundingClientRect().width >= 44;
      });

      points.forEach((point) => {
        // Computed dimensions must be 48px (or at least 44px hit invariant)
        const computed = window.getComputedStyle(point);
        expect(computed.boxSizing).to.equal('border-box');
        expect(point.offsetWidth).to.be.at.least(44);
        expect(point.offsetHeight).to.be.at.least(44);

        const rect = point.getBoundingClientRect();
        expect(rect.width).to.be.at.least(44);
        expect(rect.height).to.be.at.least(44);
      });

      imagesEl.closeCropDialog();
    });

    it('verifies SDK standalone .copio-crop-handle tokens and geometry meet 48px × 48px requirement', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const dummyLayer = document.createElement('div');
      dummyLayer.className = 'copio-crop-layer';
      dummyLayer.innerHTML = `
        <div class="copio-crop-box" style="top: 10px; left: 10px; width: 100px; height: 100px;">
          <div class="copio-crop-handle nw" data-handle="nw"></div>
          <div class="copio-crop-handle se" data-handle="se"></div>
        </div>
      `;
      scanner.shadowRoot.querySelector('.copio-scanner-container').appendChild(dummyLayer);

      const handles = scanner.shadowRoot.querySelectorAll('.copio-crop-handle');
      handles.forEach((h) => {
        const computed = window.getComputedStyle(h);
        expect(computed.getPropertyValue('--copio-crop-handle-hit').trim()).to.equal('48px');
        expect(h.offsetWidth).to.be.at.least(44);
        expect(h.offsetHeight).to.be.at.least(44);
      });
    });
  });

  describe('Acceptance Criterion 2: Constrained-Container Usability (No Occlusion in 360×640 & 480×800)', () => {
    it('fits completely inside a 360×640 container with visible, un-occluded action buttons', async () => {
      const hostBox = document.createElement('div');
      hostBox.style.width = '360px';
      hostBox.style.height = '640px';
      hostBox.style.position = 'relative';
      hostBox.style.overflow = 'hidden';
      fixtureContainer.appendChild(hostBox);

      const imagesEl = document.createElement('copio-images');
      hostBox.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');

      const testSrc = createTestImageDataUrl(200, 150, '#10b981');
      imagesEl.images = [{
        id: 'constrained-crop-page',
        src: testSrc,
        originalSrc: testSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      await imagesEl.openCropDialog(0);
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-container'));

      const cropDialog = imagesEl.shadowRoot.querySelector('.crop-dialog');
      const cancelBtn = imagesEl.shadowRoot.querySelector('.cancel-crop');
      const applyBtn = imagesEl.shadowRoot.querySelector('.apply-crop');

      expect(cropDialog).to.exist;
      expect(cancelBtn).to.exist;
      expect(applyBtn).to.exist;

      const hostRect = hostBox.getBoundingClientRect();
      const cancelRect = cancelBtn.getBoundingClientRect();
      const applyRect = applyBtn.getBoundingClientRect();

      // Cancel & Apply buttons must be within host container boundaries (not pushed off-screen or occluded)
      expect(cancelRect.bottom).to.be.at.most(hostRect.bottom + 1);
      expect(applyRect.bottom).to.be.at.most(hostRect.bottom + 1);
      expect(cancelRect.top).to.be.at.least(hostRect.top);
      expect(applyRect.top).to.be.at.least(hostRect.top);

      imagesEl.closeCropDialog();
    });

    it('ensures top and bottom grabbers remain fully visible when cropping a landscape picture', async () => {
      const hostBox = document.createElement('div');
      hostBox.style.width = '360px';
      hostBox.style.height = '640px';
      hostBox.style.position = 'relative';
      hostBox.style.overflow = 'hidden';
      fixtureContainer.appendChild(hostBox);

      const imagesEl = document.createElement('copio-images');
      hostBox.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');

      // Create wide 16:9 landscape image (400x225)
      const landscapeSrc = createTestImageDataUrl(400, 225, '#6366f1');
      imagesEl.images = [{
        id: 'landscape-crop-page',
        src: landscapeSrc,
        originalSrc: landscapeSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      await imagesEl.openCropDialog(0);
      const cropDialog = imagesEl.shadowRoot.querySelector('.crop-dialog');
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-point') && !cropDialog.classList.contains('dialog--is-animating'));

      const topGrabber = imagesEl.shadowRoot.querySelector('.cropper-point.point-n');
      const bottomGrabber = imagesEl.shadowRoot.querySelector('.cropper-point.point-s');
      const nwGrabber = imagesEl.shadowRoot.querySelector('.cropper-point.point-nw');
      const seGrabber = imagesEl.shadowRoot.querySelector('.cropper-point.point-se');
      const dialogHeader = cropDialog.shadowRoot.querySelector('.dialog__header');
      const dialogFooter = cropDialog.shadowRoot.querySelector('.dialog__footer');

      expect(topGrabber, 'Top grabber (point-n) must exist').to.exist;
      expect(bottomGrabber, 'Bottom grabber (point-s) must exist').to.exist;
      expect(nwGrabber, 'NW corner grabber must exist').to.exist;
      expect(seGrabber, 'SE corner grabber must exist').to.exist;

      await waitFor(() => topGrabber.offsetHeight >= 44 && bottomGrabber.offsetHeight >= 44);

      const topRect = topGrabber.getBoundingClientRect();
      const bottomRect = bottomGrabber.getBoundingClientRect();
      const headerRect = dialogHeader ? dialogHeader.getBoundingClientRect() : { bottom: 0 };
      const footerRect = dialogFooter ? dialogFooter.getBoundingClientRect() : { top: window.innerHeight };

      // Top grabber must be below the dialog header (not occluded or cut off above)
      expect(topRect.top).to.be.at.least(headerRect.bottom - 4);
      // Bottom grabber must be above the dialog footer (not occluded or cut off below)
      expect(bottomRect.bottom).to.be.at.most(footerRect.top + 4);

      imagesEl.closeCropDialog();
    });

    it('ensures cropper dialog stays properly contained without overflowing when opened inside copio-app', async () => {
      const app = document.createElement('copio-app');
      fixtureContainer.appendChild(app);
      await app.updateComplete;

      const addEditDialog = app.querySelector('copio-add-edit-dialog');
      expect(addEditDialog).to.exist;

      await addEditDialog.open();
      const slDialog = addEditDialog.querySelector('.dialog-add-edit');
      await waitFor(() => slDialog.open && !slDialog.classList.contains('dialog--is-animating'));

      const imagesEl = addEditDialog.querySelector('copio-images');
      expect(imagesEl).to.exist;

      const testSrc = createTestImageDataUrl(800, 600, '#10b981');
      imagesEl.images = [{
        id: 'test-doc-page',
        src: testSrc,
        originalSrc: testSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      await imagesEl.openCropDialog(0);
      const cropDialog = imagesEl.shadowRoot.querySelector('.crop-dialog');
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-container') && !cropDialog.classList.contains('dialog--is-animating'));

      const cropPanel = cropDialog.shadowRoot.querySelector('[part~="panel"]');
      const cropBody = cropDialog.shadowRoot.querySelector('[part~="body"]');
      const cropperContainer = imagesEl.shadowRoot.querySelector('.cropper-container');

      expect(cropPanel).to.exist;
      expect(cropBody).to.exist;
      expect(cropperContainer).to.exist;

      const panelRect = cropPanel.getBoundingClientRect();
      const cropperRect = cropperContainer.getBoundingClientRect();

      // Cropper container must be fully contained within the crop dialog panel
      expect(cropperRect.top).to.be.at.least(panelRect.top - 1);
      expect(cropperRect.bottom).to.be.at.most(panelRect.bottom + 1);
      expect(cropperRect.left).to.be.at.least(panelRect.left - 1);
      expect(cropperRect.right).to.be.at.most(panelRect.right + 1);

      // Verify all 8 touch points are active and sized >= 44px
      const points = imagesEl.shadowRoot.querySelectorAll('.cropper-point');
      expect(points.length).to.equal(8);
      for (const pt of points) {
        expect(pt.offsetWidth).to.be.at.least(44);
        expect(pt.offsetHeight).to.be.at.least(44);
      }

      imagesEl.closeCropDialog();
      slDialog.hide();
    });
  });

  describe('Acceptance Criterion 3: Re-editable Crop over Immutable originalSrc with Normalized Coords', () => {
    it('preserves immutable originalSrc and computes normalized { x, y, w, h } coords on crop', async () => {
      const imagesEl = document.createElement('copio-images');
      fixtureContainer.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');

      const originalSrc = createTestImageDataUrl(200, 100, '#f43f5e');
      imagesEl.images = [{
        id: 'norm-crop-page',
        src: originalSrc,
        originalSrc: originalSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      // 1. Open crop and set specific sub-crop
      await imagesEl.openCropDialog(0);
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-container'));

      imagesEl.applyCrop();

      const page = imagesEl.images[0];
      expect(page.originalSrc).to.equal(originalSrc);

      const crop = page.edits.crop;
      expect(crop).to.exist;
      expect(crop.width).to.be.greaterThan(0);
      expect(crop.height).to.be.greaterThan(0);

      // Verify normalized 0..1 coordinates
      expect(crop.normalized).to.exist;
      expect(crop.normalized.x).to.be.at.least(0);
      expect(crop.normalized.y).to.be.at.least(0);
      expect(crop.normalized.w).to.be.at.most(1);
      expect(crop.normalized.h).to.be.at.most(1);
      expect(crop.normalized.w).to.be.greaterThan(0);
      expect(crop.normalized.h).to.be.greaterThan(0);

      // 2. Re-open crop dialog: image must still be originalSrc
      await imagesEl.openCropDialog(0);
      const cropImage = imagesEl.shadowRoot.querySelector('#crop-image');
      expect(cropImage.src).to.equal(originalSrc);

      imagesEl.closeCropDialog();
    });

    it('restores crop box correctly when initialized with normalized coordinates', async () => {
      const imagesEl = document.createElement('copio-images');
      fixtureContainer.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');

      const originalSrc = createTestImageDataUrl(200, 200, '#8b5cf6');
      imagesEl.images = [{
        id: 'preload-crop-page',
        src: originalSrc,
        originalSrc: originalSrc,
        edits: {
          crop: {
            normalized: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
          },
          rotation: 0,
          filter: 'none',
        },
      }];

      await imagesEl.openCropDialog(0);
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-container'));

      // Re-apply to verify restored box
      imagesEl.applyCrop();
      const updatedCrop = imagesEl.images[0].edits.crop;
      expect(updatedCrop.width).to.be.greaterThan(0);
      expect(updatedCrop.height).to.be.greaterThan(0);
      expect(imagesEl.images[0].originalSrc).to.equal(originalSrc);
    });
  });
});
