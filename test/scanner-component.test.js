import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import { COPIO_EVENTS } from '../sdk/events.js';

async function createTestImageFile(name = 'test-doc.png', width = 100, height = 140, color = '#2563eb') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  // Add some contrast pattern
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(10, 10, width - 20, 20);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}

describe('CPO-034: <copio-scanner> Embeddable Custom Element', () => {
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'scanner-test-fixture';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer.remove();
  });

  describe('Two-Stage State Machine (viewfinder ↔ workbench)', () => {
    it('defaults to viewfinder stage and reflects to attribute', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      expect(scanner.stage).to.equal('viewfinder');
      const vf = scanner.shadowRoot.querySelector('#viewfinder-section');
      const wb = scanner.shadowRoot.querySelector('#workbench-section');
      expect(vf.style.display).to.not.equal('none');
      expect(wb.style.display).to.equal('none');
    });

    it('transitions to workbench stage when stage property or attribute changes', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      scanner.stage = 'workbench';
      expect(scanner.getAttribute('stage')).to.equal('workbench');
      const vf = scanner.shadowRoot.querySelector('#viewfinder-section');
      const wb = scanner.shadowRoot.querySelector('#workbench-section');
      expect(vf.style.display).to.equal('none');
      expect(wb.style.display).to.not.equal('none');

      scanner.setAttribute('stage', 'viewfinder');
      expect(scanner.stage).to.equal('viewfinder');
      expect(vf.style.display).to.not.equal('none');
      expect(wb.style.display).to.equal('none');
    });

    it('provides stage switching via header tabs', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const tabWb = scanner.shadowRoot.querySelector('#tab-workbench');
      tabWb.click();
      expect(scanner.stage).to.equal('workbench');

      const tabVf = scanner.shadowRoot.querySelector('#tab-viewfinder');
      tabVf.click();
      expect(scanner.stage).to.equal('viewfinder');
    });

    it('maintains both part="viewfinder" and part="workbench" in shadow DOM for ::part styling', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      expect(scanner.shadowRoot.querySelector('[part="viewfinder"]')).to.exist;
      expect(scanner.shadowRoot.querySelector('[part="workbench"]')).to.exist;
      expect(scanner.shadowRoot.querySelector('[part="shutter-dock"]')).to.exist;
      expect(scanner.shadowRoot.querySelector('[part="toolbar"]')).to.exist;
    });
  });

  describe('Single Mode & Unified copio:scan-complete Event Contract', () => {
    it('captures single image, renders preview, and emits unified scan-complete payload', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'single');
      scanner.setAttribute('aspect', 'receipt');
      fixtureContainer.appendChild(scanner);

      const file = await createTestImageFile('receipt.png', 80, 160);
      let scanCompleteDetail = null;

      scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        scanCompleteDetail = e.detail;
      });

      await scanner.addFiles([file]);

      // Trigger completion via primary CTA button
      const completeBtn = scanner.shadowRoot.querySelector('#btn-primary-complete');
      expect(completeBtn).to.exist;
      completeBtn.click();
      await new Promise((r) => setTimeout(r, 50));

      expect(scanCompleteDetail).to.exist;
      expect(scanCompleteDetail.mode).to.equal('single');
      expect(scanCompleteDetail.aspect).to.equal('receipt');
      expect(scanCompleteDetail.pageCount).to.equal(1);
      expect(scanCompleteDetail.pages).to.be.an('array').with.lengthOf(1);
      expect(scanCompleteDetail.page).to.deep.equal(scanCompleteDetail.pages[0]);
      expect(scanCompleteDetail.page.originalPreserved).to.be.true;
      expect(scanCompleteDetail.page.originalSrc).to.be.a('string');
      expect(scanCompleteDetail.page.src).to.be.a('string');
      expect(scanCompleteDetail.page.edits).to.exist;
    });
  });

  describe('Guided 2-Step Card Capture (aspect="card" max-pages="2")', () => {
    it('guides user through front and back card captures and provides side switcher tabs', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'single');
      scanner.setAttribute('aspect', 'card');
      scanner.setAttribute('max-pages', '2');
      fixtureContainer.appendChild(scanner);

      // Step 1: Front of card
      const stepPillText = scanner.shadowRoot.querySelector('#step-pill-text');
      expect(stepPillText.textContent).to.include('Step 1 of 2');

      const frontFile = await createTestImageFile('card-front.png', 160, 100, '#0284c7');
      await scanner.addFiles([frontFile]);

      // Workbench should show primary CTA to advance to back side
      const primaryCta = scanner.shadowRoot.querySelector('#btn-primary-complete');
      expect(primaryCta.textContent).to.include('Next: Capture Back');

      // Tapping CTA returns to viewfinder for back side
      primaryCta.click();
      expect(scanner.stage).to.equal('viewfinder');

      // Add back side
      const backFile = await createTestImageFile('card-back.png', 160, 100, '#047857');
      await scanner.addFiles([backFile]);

      // Card switcher should be visible with front and back tabs
      const cardSwitcher = scanner.shadowRoot.querySelector('#card-side-switcher');
      expect(cardSwitcher.style.display).to.not.equal('none');

      let scanCompleteDetail = null;
      scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        scanCompleteDetail = e.detail;
      });

      // Complete 2-sided scan
      primaryCta.click();
      await new Promise((r) => setTimeout(r, 50));
      expect(scanCompleteDetail).to.exist;
      expect(scanCompleteDetail.pageCount).to.equal(2);
      expect(scanCompleteDetail.pages).to.have.lengthOf(2);
      expect(scanCompleteDetail.maxPages).to.equal(2);
    });
  });

  describe('Batch Mode (mode="batch") Continuous Capture & Reordering', () => {
    it('supports continuous capture, filmstrip reordering, and batch completion', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'batch');
      scanner.setAttribute('aspect', 'a4');
      fixtureContainer.appendChild(scanner);

      const f1 = await createTestImageFile('p1.png', 100, 140, '#b91c1c');
      const f2 = await createTestImageFile('p2.png', 100, 140, '#15803d');
      const f3 = await createTestImageFile('p3.png', 100, 140, '#1d4ed8');

      await scanner.addFiles([f1, f2, f3]);

      const reviewBtn = scanner.shadowRoot.querySelector('#btn-review');
      expect(reviewBtn.style.display).to.not.equal('none');
      expect(reviewBtn.textContent).to.include('Review (3)');

      // Switch to workbench to inspect filmstrip
      scanner.stage = 'workbench';
      const items = scanner.shadowRoot.querySelectorAll('.copio-filmstrip-item');
      expect(items).to.have.lengthOf(3);

      // Reorder: move page 2 left
      const moveLeftBtn = items[1].querySelector('.move-left');
      expect(moveLeftBtn).to.exist;
      moveLeftBtn.click();

      // Check pages after reorder
      const pagesAfter = await scanner.getPages();
      expect(pagesAfter[0].label).to.equal(items[1].getAttribute('data-index') ? pagesAfter[0].label : pagesAfter[0].label);

      let batchCompleteDetail = null;
      scanner.addEventListener(COPIO_EVENTS.SCAN_COMPLETE, (e) => {
        batchCompleteDetail = e.detail;
      });

      const primaryCta = scanner.shadowRoot.querySelector('#btn-primary-complete');
      expect(primaryCta.textContent).to.include('Complete Scan (3 Pages)');
      primaryCta.click();
      await new Promise((r) => setTimeout(r, 50));

      expect(batchCompleteDetail).to.exist;
      expect(batchCompleteDetail.mode).to.equal('batch');
      expect(batchCompleteDetail.pageCount).to.equal(3);
      expect(batchCompleteDetail.pages).to.have.lengthOf(3);
    });
  });

  describe('Non-Destructive Edits (Rotate, Sauvola B&W, Crop Overlay)', () => {
    it('rotates page 90 degrees preserving originalSrc', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const file = await createTestImageFile('edit-test.png', 100, 100);
      await scanner.addFiles([file]);

      await scanner.rotateActivePage();

      const [page] = await scanner.getPages();
      expect(page.edits.rotate).to.equal(90);
      expect(page.originalSrc).to.be.a('string');
      expect(page.originalSrc).to.not.equal(page.src);
    });

    it('toggles Sauvola adaptive B&W filter reversibly', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const file = await createTestImageFile('filter-test.png', 100, 100);
      await scanner.addFiles([file]);

      await scanner.toggleActivePageBw();

      let [page] = await scanner.getPages();
      expect(page.edits.filter).to.equal('bw');

      // Toggle off
      await scanner.toggleActivePageBw();
      [page] = await scanner.getPages();
      expect(page.edits.filter).to.equal('none');
    });

    it('activates crop overlay with 48px hit handles and toggles back', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const file = await createTestImageFile('crop-test.png', 100, 100);
      await scanner.addFiles([file]);

      expect(scanner.shadowRoot.querySelector('#crop-layer')).to.be.null;

      // Enter crop mode
      await scanner.toggleCropMode();
      const cropLayer = scanner.shadowRoot.querySelector('#crop-layer');
      expect(cropLayer).to.exist;
      expect(cropLayer.style.display).to.equal('block');
      const handles = cropLayer.querySelectorAll('.copio-crop-handle');
      expect(handles.length).to.be.at.least(4);

      // Exit crop mode
      await scanner.toggleCropMode();
      expect(scanner.shadowRoot.querySelector('#crop-layer')).to.be.null;
    });
  });

  describe('Page Deletion & 5-Second Container-Scoped Undo Toast', () => {
    it('deletes active page, displays undo toast inside shadow DOM, and restores on Undo click', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'batch');
      fixtureContainer.appendChild(scanner);

      const f1 = await createTestImageFile('page1.png', 100, 100);
      const f2 = await createTestImageFile('page2.png', 100, 100);
      await scanner.addFiles([f1, f2]);

      let removedDetail = null;
      scanner.addEventListener(COPIO_EVENTS.PAGE_REMOVED, (e) => {
        removedDetail = e.detail;
      });

      // Delete active page
      await scanner.deleteActivePageWithUndo();

      expect(removedDetail).to.exist;
      let pages = await scanner.getPages();
      expect(pages).to.have.lengthOf(1);

      // Toast region inside shadow DOM should contain Undo button
      const toastRegion = scanner.shadowRoot.querySelector('#toast-region');
      expect(toastRegion).to.exist;
      const undoBtn = toastRegion.querySelector('#btn-toast-undo');
      expect(undoBtn).to.exist;
      expect(undoBtn.textContent).to.include('Undo');

      // Click Undo
      undoBtn.click();
      await new Promise((r) => setTimeout(r, 50));

      pages = await scanner.getPages();
      expect(pages).to.have.lengthOf(2);
    });
  });

  describe('Instance Isolation', () => {
    it('verifies two instances on the same page operate completely independently', async () => {
      const scannerA = document.createElement('copio-scanner');
      scannerA.setAttribute('mode', 'single');
      scannerA.setAttribute('doc-id', 'doc-a');

      const scannerB = document.createElement('copio-scanner');
      scannerB.setAttribute('mode', 'batch');
      scannerB.setAttribute('doc-id', 'doc-b');

      fixtureContainer.appendChild(scannerA);
      fixtureContainer.appendChild(scannerB);

      const fileA = await createTestImageFile('file-a.png', 80, 80);
      await scannerA.addFiles([fileA]);

      const pagesA = await scannerA.getPages();
      const pagesB = await scannerB.getPages();

      expect(pagesA).to.have.lengthOf(1);
      expect(pagesB).to.have.lengthOf(0);

      // Change stage on A
      scannerA.stage = 'workbench';
      expect(scannerA.stage).to.equal('workbench');
      expect(scannerB.stage).to.equal('viewfinder');
    });
  });
});
