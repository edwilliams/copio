import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import { DocRepository } from '../js/services/doc-repository.js';
import { MemoryStorageAdapter } from '../js/adapters/storage/memory-adapter.js';
import { applyEdits } from '../js/utils/utils.js';
import { normalizeEditStack } from '../sdk/models.js';

function createTestImageDataUrl(width = 40, height = 20, color = '#ff0000') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
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
    it('Normalizes edit stack with default values', () => {
      const normalized = normalizeEditStack({ rotate: 90, filter: 'bw' });
      expect(normalized.rotate).to.equal(90);
      expect(normalized.filter).to.equal('bw');
      expect(normalized.crop).to.be.null;

      const withCrop = normalizeEditStack({ crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } });
      expect(withCrop.crop).to.deep.equal({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
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
  });
});
