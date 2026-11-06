import { expect } from '@esm-bundle/chai';
import '../sdk/scanner.js';

describe('Streamline Add/Import UX & Direct File/Camera Picker (CPO-027)', function () {
  this.timeout(10000);
  let scanner;

  beforeEach(() => {
    scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);
  });

  afterEach(() => {
    scanner.remove();
  });

  it('direct file input is available in scanner shadowRoot with image accept', () => {
    const fileInput = scanner.shadowRoot.querySelector('#internal-file-input');
    expect(fileInput).to.exist;
    expect(fileInput.type).to.equal('file');
    expect(fileInput.accept).to.include('image/*');
  });

  it('import button triggers file input click', () => {
    const fileInput = scanner.shadowRoot.querySelector('#internal-file-input');
    const importBtn = scanner.shadowRoot.querySelector('#btn-import-file');
    expect(fileInput).to.exist;
    expect(importBtn).to.exist;

    let clicked = false;
    fileInput.addEventListener('click', () => {
      clicked = true;
    });

    importBtn.click();
    expect(clicked).to.be.true;
  });

  it('viewfinder provides dedicated camera shutter button', () => {
    const shutterBtn = scanner.shadowRoot.querySelector('#btn-shutter');
    expect(shutterBtn).to.exist;
    expect(shutterBtn.getAttribute('aria-label')).to.include('Capture page');
  });
});
