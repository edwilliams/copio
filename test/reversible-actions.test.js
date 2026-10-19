import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { DocRepository } from '../js/services/doc-repository.js';
import { MemoryStorageAdapter } from '../js/adapters/storage/memory-adapter.js';
import { applyEdits } from '../js/utils/utils.js';
import { notify } from '../js/services/notify.js';

function createTestImageDataUrl(width = 40, height = 20, color = '#ff0000') {
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

function getImagePixels(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve({
        width: img.width,
        height: img.height,
        data: Array.from(ctx.getImageData(0, 0, img.width, img.height).data),
      });
    };
    img.onerror = reject;
    img.src = src;
  });
}

describe('Group F: Reversible Actions & Data Durability (CPO-011 + CPO-016)', function () {
  this.timeout(10000);

  describe('CPO-011: Non-destructive page edits', () => {
    let imagesEl;

    beforeEach(async () => {
      imagesEl = document.createElement('copio-images');
      document.body.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');
    });

    afterEach(() => {
      imagesEl?.remove();
    });

    it('Applying B&W then toggling it off restores the original pixels', async () => {
      const originalSrc = createTestImageDataUrl(30, 30, '#38bdf8');
      imagesEl.images = [{
        id: 'bw-test-page',
        src: originalSrc,
        originalSrc: originalSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      const originalPixels = await getImagePixels(originalSrc);

      // 1. Toggle B&W on
      await imagesEl.thresholdImage(0);
      const bwSrc = imagesEl.images[0].src;
      expect(bwSrc).to.not.equal(originalSrc);
      expect(imagesEl.images[0].edits.filter).to.equal('bw');

      // 2. Toggle B&W off
      await imagesEl.thresholdImage(0);
      const restoredSrc = imagesEl.images[0].src;
      expect(imagesEl.images[0].edits.filter).to.equal('none');
      expect(restoredSrc).to.equal(originalSrc);

      const restoredPixels = await getImagePixels(restoredSrc);
      expect(restoredPixels.data).to.deep.equal(originalPixels.data);
    });

    it('Re-cropping starts from the original image with the prior box pre-selected', async () => {
      const originalSrc = createTestImageDataUrl(100, 100, '#eab308');
      imagesEl.images = [{
        id: 'recrop-test-page',
        src: originalSrc,
        originalSrc: originalSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      // 1. First crop
      await imagesEl.openCropDialog(0);
      await waitFor(() => imagesEl.shadowRoot.querySelector('.cropper-container'));

      imagesEl.applyCrop();
      const firstCrop = imagesEl.images[0].edits.crop;
      expect(firstCrop).to.exist;
      expect(firstCrop.width).to.be.greaterThan(0);

      // 2. Re-open crop dialog: should display originalSrc, not croppedSrc
      await imagesEl.openCropDialog(0);
      const cropImg = imagesEl.shadowRoot.querySelector('#crop-image');
      expect(cropImg.src).to.equal(originalSrc);

      imagesEl.closeCropDialog();
    });

    it('Reset to original clears all edits and restores the unedited source', async () => {
      const originalSrc = createTestImageDataUrl(40, 20, '#ec4899');
      imagesEl.images = [{
        id: 'reset-test-page',
        src: originalSrc,
        originalSrc: originalSrc,
        edits: { crop: null, rotation: 0, filter: 'none' },
      }];

      // Apply rotation and B&W
      await imagesEl.rotateImage(0);
      await imagesEl.thresholdImage(0);

      expect(imagesEl.images[0].edits.rotation).to.equal(90);
      expect(imagesEl.images[0].edits.filter).to.equal('bw');
      expect(imagesEl.images[0].src).to.not.equal(originalSrc);

      // Trigger reset
      imagesEl.resetImage(0);

      expect(imagesEl.images[0].edits).to.deep.equal({ crop: null, rotation: 0, filter: 'none' });
      expect(imagesEl.images[0].src).to.equal(originalSrc);
    });

    it('New pages saved through images setter/import normalize originalSrc and edits', () => {
      const rawSrc = createTestImageDataUrl(20, 20, '#10b981');
      imagesEl.images = [{ id: 'legacy-page', src: rawSrc }];

      expect(imagesEl.images[0].originalSrc).to.equal(rawSrc);
      expect(imagesEl.images[0].edits).to.deep.equal({ crop: null, rotation: 0, filter: 'none' });
    });

    it('applyEdits pure utility generates expected non-destructive transformations', async () => {
      const src = createTestImageDataUrl(60, 40, '#6366f1');

      // No edits returns original
      const unchanged = await applyEdits(src, { crop: null, rotation: 0, filter: 'none' });
      expect(unchanged).to.equal(src);

      // Rotated 90
      const rotated = await applyEdits(src, { crop: null, rotation: 90, filter: 'none' });
      const rotPixels = await getImagePixels(rotated);
      expect(rotPixels.width).to.equal(40);
      expect(rotPixels.height).to.equal(60);

      // Cropped
      const cropped = await applyEdits(src, { crop: { x: 5, y: 5, width: 30, height: 20 }, rotation: 0, filter: 'none' });
      const cropPixels = await getImagePixels(cropped);
      expect(cropPixels.width).to.equal(30);
      expect(cropPixels.height).to.equal(20);
    });
  });

  describe('CPO-016: Undo for destructive actions', () => {
    let repo;

    beforeEach(async () => {
      repo = new DocRepository(new MemoryStorageAdapter());
      await repo.init();
    });

    it('Deleting a document can be undone via undoDeleteDoc within timeout', async () => {
      const doc = await repo.createDoc('Important Contract', [
        { id: 'page-1', src: 'data:1' },
        { id: 'page-2', src: 'data:2' },
      ]);

      const res = await repo.deleteDoc(doc.id, { soft: true, timeoutMs: 2000 });
      expect(res).to.exist;
      expect(res.name).to.equal('Important Contract');

      // Immediately removed from active queries
      expect(await repo.getDoc(doc.id)).to.be.null;
      expect((await repo.listDocs()).some((d) => d.id === doc.id)).to.be.false;

      // Undo deletion
      const restored = await repo.undoDeleteDoc(doc.id);
      expect(restored).to.exist;
      expect(restored.id).to.equal(doc.id);
      expect(restored.name).to.equal('Important Contract');
      expect(restored.pages).to.have.lengthOf(2);

      const fetched = await repo.getDoc(doc.id);
      expect(fetched).to.exist;
      expect(fetched.name).to.equal('Important Contract');
    });

    it('Deleting a page can be undone via undoDeletePage, fully restoring order', async () => {
      const doc = await repo.createDoc('Multi-page Score', [
        { id: 'p1', name: 'Movement 1' },
        { id: 'p2', name: 'Movement 2' },
        { id: 'p3', name: 'Movement 3' },
      ]);

      // Delete middle page p2
      const res = await repo.deletePage(doc.id, 'p2', { soft: true, timeoutMs: 2000 });
      expect(res).to.exist;

      let currentDoc = await repo.getDoc(doc.id);
      expect(currentDoc.pages.map((p) => p.id)).to.deep.equal(['p1', 'p3']);

      // Undo delete
      const restoredPage = await repo.undoDeletePage(doc.id, 'p2');
      expect(restoredPage).to.exist;
      expect(restoredPage.id).to.equal('p2');

      // Verify exact original order is restored
      currentDoc = await repo.getDoc(doc.id);
      expect(currentDoc.pages.map((p) => p.id)).to.deep.equal(['p1', 'p2', 'p3']);
    });

    it('Soft delete expires after timeout and cannot be restored afterwards', async () => {
      const doc = await repo.createDoc('Expiring Doc');
      await repo.deleteDoc(doc.id, { soft: true, timeoutMs: 50 });

      expect(repo.isSoftDeletedDoc(doc.id)).to.be.true;

      await new Promise((r) => setTimeout(r, 80));

      expect(repo.isSoftDeletedDoc(doc.id)).to.be.false;
      const attemptUndo = await repo.undoDeleteDoc(doc.id);
      expect(attemptUndo).to.be.null;
    });

    it('UI: Deleting a page in copio-images triggers undo toast, restoring page and order', async () => {
      const imagesEl = document.createElement('copio-images');
      document.body.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');

      imagesEl.images = [
        { id: 'page-a', src: createTestImageDataUrl(10, 10, '#111') },
        { id: 'page-b', src: createTestImageDataUrl(10, 10, '#222') },
        { id: 'page-c', src: createTestImageDataUrl(10, 10, '#333') },
      ];

      // Delete middle page (page-b)
      const menus = imagesEl.shadowRoot.querySelectorAll('.image-menu');
      const middleMenu = menus[1].querySelector('sl-menu');

      let capturedUndoCallback = null;
      const originalUndo = notify.undo;
      notify.undo = (message, onUndo, options) => {
        capturedUndoCallback = onUndo;
        return originalUndo(message, onUndo, options);
      };

      try {
        middleMenu.dispatchEvent(
          new CustomEvent('sl-select', {
            bubbles: true,
            composed: true,
            detail: { item: { value: 'delete' } },
          }),
        );

        expect(imagesEl.images.map((p) => p.id)).to.deep.equal(['page-a', 'page-c']);
        expect(capturedUndoCallback).to.be.a('function');

        // Click Undo
        capturedUndoCallback();

        // Exact original order restored
        expect(imagesEl.images.map((p) => p.id)).to.deep.equal(['page-a', 'page-b', 'page-c']);
      } finally {
        notify.undo = originalUndo;
        imagesEl.remove();
      }
    });
  });
});
