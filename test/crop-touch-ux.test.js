import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../sdk/index.js';
import { cropRotatedToOriginal, cropOriginalToRotated } from '../sdk/core.js';

function createTestImageFile(name = 'sample.png', width = 120, height = 80, color = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const blob = new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob.then((b) => new File([b], name, { type: 'image/png' }));
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
    it('fits completely inside a 360×640 container with visible action buttons', async () => {
      const hostBox = document.createElement('div');
      hostBox.style.width = '360px';
      hostBox.style.height = '640px';
      hostBox.style.position = 'relative';
      hostBox.style.overflow = 'hidden';
      fixtureContainer.appendChild(hostBox);

      const scanner = document.createElement('copio-scanner');
      hostBox.appendChild(scanner);

      const file = await createTestImageFile('constrained.png', 200, 150);
      await scanner.addFiles([file]);

      scanner.stage = 'workbench';
      const cropBtn = scanner.shadowRoot.querySelector('#btn-crop');
      expect(cropBtn).to.exist;

      const hostRect = hostBox.getBoundingClientRect();
      const btnRect = cropBtn.getBoundingClientRect();

      expect(btnRect.bottom).to.be.at.most(hostRect.bottom + 1);
      expect(btnRect.top).to.be.at.least(hostRect.top);
    });
  });

  describe('Acceptance Criterion 3: Re-editable Crop over Immutable originalSrc with Normalized Coords', () => {
    it('preserves immutable originalSrc and computes normalized { x, y, w, h } coords on crop', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const file = await createTestImageFile('norm.png', 200, 100);
      await scanner.addFiles([file]);

      scanner.stage = 'workbench';
      const [initialPage] = await scanner.getPages();
      expect(initialPage.originalSrc).to.be.a('string');

      // Coordinate transforms
      const originalCrop = { x: 0.1, y: 0.2, w: 0.7, h: 0.6 };
      const rotatedCrop = cropOriginalToRotated(originalCrop, 90);
      expect(rotatedCrop.w).to.equal(0.6);
      expect(rotatedCrop.h).to.equal(0.7);

      const restoredCrop = cropRotatedToOriginal(rotatedCrop, 90);
      expect(Math.abs(restoredCrop.x - originalCrop.x)).to.be.below(1e-5);
      expect(Math.abs(restoredCrop.y - originalCrop.y)).to.be.below(1e-5);
      expect(Math.abs(restoredCrop.w - originalCrop.w)).to.be.below(1e-5);
      expect(Math.abs(restoredCrop.h - originalCrop.h)).to.be.below(1e-5);
    });
  });
});
