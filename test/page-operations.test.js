import { expect } from '@esm-bundle/chai';
import '../sdk/scanner.js';

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

describe('Page Operations & Editing via <copio-scanner>', function () {
  this.timeout(10000);
  let scanner;

  beforeEach(() => {
    scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
  });

  afterEach(() => {
    scanner.remove();
  });

  it('adds a single image file via addFiles', async () => {
    const file = await createTestImageFile('receipt.png', 40, 40, '#22c55e');
    const added = await scanner.addFiles([file]);

    expect(added).to.have.lengthOf(1);
    const pages = await scanner.getPages();
    expect(pages).to.have.lengthOf(1);
    expect(pages[0].src).to.match(/^(data|blob):/);
  });

  it('adds multiple image files in a single call', async () => {
    const file1 = await createTestImageFile('page1.png', 30, 30, '#ef4444');
    const file2 = await createTestImageFile('page2.png', 30, 30, '#3b82f6');

    const added = await scanner.addFiles([file1, file2]);
    expect(added).to.have.lengthOf(2);

    const pages = await scanner.getPages();
    expect(pages).to.have.lengthOf(2);
    expect(pages[0].id).to.not.equal(pages[1].id);
  });

  it('rotates active page non-destructively', async () => {
    const file = await createTestImageFile('rotate-test.png', 30, 30);
    await scanner.addFiles([file]);

    await scanner.rotateActivePage();
    const [page] = await scanner.getPages();
    expect(page.edits.rotate).to.equal(90);
  });

  it('toggles Sauvola B&W filter non-destructively', async () => {
    const file = await createTestImageFile('filter-test.png', 30, 30);
    await scanner.addFiles([file]);

    await scanner.toggleActivePageBw();
    let [page] = await scanner.getPages();
    expect(page.edits.filter).to.equal('bw');

    await scanner.toggleActivePageBw();
    [page] = await scanner.getPages();
    expect(page.edits.filter).to.equal('none');
  });

  it('deletes active page with undo support', async () => {
    const file1 = await createTestImageFile('p1.png', 30, 30);
    const file2 = await createTestImageFile('p2.png', 30, 30);
    await scanner.addFiles([file1, file2]);

    await scanner.deleteActivePageWithUndo();
    const remaining = await scanner.getPages();
    expect(remaining).to.have.lengthOf(1);
  });
});
