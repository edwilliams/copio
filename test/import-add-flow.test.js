import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';

describe('Streamline Add/Import UX & Direct File/Camera Picker (CPO-027)', function () {
  this.timeout(10000);

  describe('copio-images: direct file and camera picker', () => {
    let imagesEl;

    beforeEach(async () => {
      imagesEl = document.createElement('copio-images');
      document.body.appendChild(imagesEl);
      await customElements.whenDefined('copio-images');
    });

    afterEach(() => {
      imagesEl?.remove();
    });

    it('tapping + opens system file chooser directly without an intermediate dialog', async () => {
      // Acceptance criteria: No intermediate .upload-dialog modal
      expect(imagesEl.shadowRoot.querySelector('.upload-dialog')).to.be.null;

      const fileInput = imagesEl.shadowRoot.querySelector('.file-input');
      expect(fileInput).to.exist;
      expect(fileInput.type).to.equal('file');
      expect(fileInput.multiple).to.be.true;
      expect(fileInput.accept).to.include('image/*');
      expect(fileInput.accept).to.include('application/pdf');

      let fileInputClicked = false;
      const clickListener = () => {
        fileInputClicked = true;
      };
      fileInput.addEventListener('click', clickListener);

      const addBtn = imagesEl.shadowRoot.querySelector('.add-image-btn');
      expect(addBtn).to.exist;
      addBtn.click();

      expect(fileInputClicked).to.be.true;
      fileInput.removeEventListener('click', clickListener);
    });

    it('mobile camera capture option is available with capture="environment"', async () => {
      // Acceptance criteria: Mobile camera capture option available
      const cameraBtn = imagesEl.shadowRoot.querySelector('.add-camera-btn');
      expect(cameraBtn).to.exist;
      expect(cameraBtn.title).to.include('camera');

      const cameraInput = imagesEl.shadowRoot.querySelector('.camera-input');
      expect(cameraInput).to.exist;
      expect(cameraInput.type).to.equal('file');
      expect(cameraInput.accept).to.equal('image/*');
      expect(cameraInput.getAttribute('capture')).to.equal('environment');

      let cameraInputClicked = false;
      const clickListener = () => {
        cameraInputClicked = true;
      };
      cameraInput.addEventListener('click', clickListener);

      cameraBtn.click();
      expect(cameraInputClicked).to.be.true;
      cameraInput.removeEventListener('click', clickListener);
    });

    it('drag-over gives visual drop target feedback on .container', async () => {
      // Acceptance criteria: Drag-over gives visual drop target feedback
      const container = imagesEl.shadowRoot.querySelector('.container');
      expect(container).to.exist;
      expect(container.classList.contains('drag-over')).to.be.false;

      // Simulate dragging files into container
      const dragEnterEvent = new Event('dragenter', { bubbles: true, cancelable: true });
      dragEnterEvent.dataTransfer = { types: ['Files'] };
      container.dispatchEvent(dragEnterEvent);

      expect(container.classList.contains('drag-over')).to.be.true;

      // Simulate dragover maintaining feedback
      const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
      dragOverEvent.dataTransfer = { types: ['Files'] };
      container.dispatchEvent(dragOverEvent);

      expect(container.classList.contains('drag-over')).to.be.true;

      // Simulate drag leaving container
      const dragLeaveEvent = new Event('dragleave', { bubbles: true, cancelable: true });
      container.dispatchEvent(dragLeaveEvent);

      expect(container.classList.contains('drag-over')).to.be.false;

      // Simulate drag enter followed by drop
      container.dispatchEvent(dragEnterEvent);
      expect(container.classList.contains('drag-over')).to.be.true;

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      dropEvent.dataTransfer = { files: [] };
      container.dispatchEvent(dropEvent);

      expect(container.classList.contains('drag-over')).to.be.false;
    });

    it('selecting an image via fileInput adds exactly one copy (no duplicate upload)', async () => {
      // 1x1 transparent PNG data
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const binary = atob(base64Data);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const file = new File([array], 'sample.png', { type: 'image/png' });

      const fileInput = imagesEl.shadowRoot.querySelector('.file-input');
      expect(fileInput).to.exist;

      // Simulate file selection
      fileInput.onchange({ target: { files: [file] } });

      // Wait for image to be added
      const start = Date.now();
      while (imagesEl.images.length === 0 && Date.now() - start < 3000) {
        await new Promise((r) => setTimeout(r, 20));
      }

      // Must be EXACTLY 1 image, not 2
      expect(imagesEl.images).to.have.lengthOf(1);
    });

    it('supports mobile/WebKit drag data types on .container', async () => {
      const container = imagesEl.shadowRoot.querySelector('.container');

      // iOS Safari sends public.jpeg or image/jpeg during drag
      const mobileDragEvent = new Event('dragenter', { bubbles: true, cancelable: true });
      mobileDragEvent.dataTransfer = { types: ['public.jpeg', 'image/jpeg'] };
      container.dispatchEvent(mobileDragEvent);

      expect(container.classList.contains('drag-over')).to.be.true;

      const dragLeaveEvent = new Event('dragleave', { bubbles: true, cancelable: true });
      container.dispatchEvent(dragLeaveEvent);
      expect(container.classList.contains('drag-over')).to.be.false;
    });

    it('tapping empty container background triggers file picker', async () => {
      const container = imagesEl.shadowRoot.querySelector('.container');
      const fileInput = imagesEl.shadowRoot.querySelector('.file-input');

      let clicked = false;
      const clickListener = () => {
        clicked = true;
      };
      fileInput.addEventListener('click', clickListener);

      // Click directly on container surface
      container.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(clicked).to.be.true;
      fileInput.removeEventListener('click', clickListener);
    });
  });

  describe('copio-add-edit-dialog: title validation without prompt()', () => {
    let dialogEl;
    let originalPrompt;
    let promptCallCount = 0;

    beforeEach(async () => {
      promptCallCount = 0;
      originalPrompt = window.prompt;
      window.prompt = () => {
        promptCallCount++;
        return 'Should Not Be Called';
      };

      dialogEl = document.createElement('copio-add-edit-dialog');
      document.body.appendChild(dialogEl);
      await dialogEl.updateComplete;
    });

    afterEach(() => {
      window.prompt = originalPrompt;
      dialogEl?.remove();
    });

    it('blank title shows inline validation error instead of prompt()', async () => {
      // Acceptance criteria: Blank title shows inline validation error instead of prompt()
      let saveEventDispatched = false;
      dialogEl.addEventListener('dialog:save', () => {
        saveEventDispatched = true;
      });

      const nameInput = dialogEl.querySelector('.dialog-add-edit-input-name');
      expect(nameInput).to.exist;
      nameInput.value = '';

      const saveBtn = dialogEl.querySelector('.dialog-add-edit-savebtn');
      expect(saveBtn).to.exist;
      saveBtn.click();
      await dialogEl.updateComplete;

      // prompt() must NEVER be invoked
      expect(promptCallCount).to.equal(0);
      expect(saveEventDispatched).to.be.false;

      // Inline validation error must be displayed
      const errorEl = dialogEl.querySelector('.dialog-name-error');
      expect(errorEl).to.exist;
      expect(errorEl.style.display).to.not.equal('none');
      expect(errorEl.textContent).to.include('Please enter a document name');
      expect(nameInput.classList.contains('input-invalid')).to.be.true;
    });

    it('typing into name input clears validation error, and saving valid name succeeds', async () => {
      let savedDetail = null;
      dialogEl.addEventListener('dialog:save', (e) => {
        savedDetail = e.detail;
      });

      const nameInput = dialogEl.querySelector('.dialog-add-edit-input-name');
      const saveBtn = dialogEl.querySelector('.dialog-add-edit-savebtn');
      const errorEl = dialogEl.querySelector('.dialog-name-error');

      // First trigger blank validation
      nameInput.value = '   ';
      saveBtn.click();
      await dialogEl.updateComplete;

      expect(errorEl.style.display).to.not.equal('none');
      expect(nameInput.classList.contains('input-invalid')).to.be.true;
      expect(savedDetail).to.be.null;

      // Type valid name
      nameInput.value = 'Project Blueprint';
      nameInput.dispatchEvent(new CustomEvent('sl-input', { bubbles: true }));
      await dialogEl.updateComplete;

      expect(errorEl.style.display).to.equal('none');
      expect(nameInput.classList.contains('input-invalid')).to.be.false;

      // Click save
      saveBtn.click();
      await dialogEl.updateComplete;

      expect(savedDetail).to.exist;
      expect(savedDetail.name).to.equal('Project Blueprint');
      expect(promptCallCount).to.equal(0);
    });
  });
});
