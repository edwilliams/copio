// @ts-nocheck
import { LitElement, html } from '../../lib/lit-core.min.js';
import { randomId } from '../../utils/utils.js';

export class CopioAddEditDialog extends LitElement {
  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#clearValidation();
  }

  #handleScanClick = async () => {
    const innerScannerDialog = this.querySelector('.dialog-inner-scanner');
    const innerScanner = this.querySelector('.inner-copio-scanner');
    if (innerScanner) {
      await innerScanner.clear?.();
    }
    if (innerScannerDialog) {
      await innerScannerDialog.show();
    }
  };

  #handleInnerScanComplete = (e) => {
    const detail = e.detail || {};
    const pages = detail.pages || (detail.page ? [detail.page] : []);
    const innerScannerDialog = this.querySelector('.dialog-inner-scanner');
    const copioImages = this.querySelector('copio-images');

    if (copioImages && pages && pages.length > 0) {
      const current = copioImages.images || [];
      copioImages.images = [
        ...current,
        ...pages.map(({ id, src, originalSrc, edits, exif, type, name, content }) => ({
          id: id || randomId(),
          src,
          originalSrc: originalSrc || src,
          edits: edits || { crop: null, rotation: 0, filter: 'none' },
          exif,
          type,
          name,
          content,
        })),
      ];
    }

    if (innerScannerDialog && innerScannerDialog.open) {
      innerScannerDialog.hide();
    }
  };

  #clearValidation = () => {
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const nameError = this.querySelector('.dialog-name-error');
    if (nameError) nameError.style.display = 'none';
    if (inputName) {
      inputName.classList.remove('input-invalid');
      inputName.style.removeProperty('--sl-input-border-color');
      inputName.style.removeProperty('--sl-input-border-color-focus');
      if (typeof inputName.setCustomValidity === 'function') {
        try {
          inputName.setCustomValidity('');
        } catch {}
      }
    }
  };

  #handleNameInput = (e) => {
    if (e.target?.value?.trim()) {
      this.#clearValidation();
    }
  };

  #handleHide = (event) => {
    if (event.target !== event.currentTarget) return;
    
    this.#clearValidation();
    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    if (inputId) inputId.value = '';
    if (inputName) inputName.value = '';
    if (copioImages) copioImages.images = [];
    
    this.dispatchEvent(new CustomEvent('dialog:close', { bubbles: true, composed: false }));
  };

  #handleKeydown = (e) => {
    if (e.key !== 'Enter') return;
    // Don't intercept Enter when a nested dialog/modal is open (note editor, cropper, etc.)
    if (this.querySelector('sl-dialog[open]')) return;
    if (e.target?.classList?.contains('dialog-add-edit-input-name')) {
      e.preventDefault();
      this.#handleSave();
      return;
    }
    // Don't intercept Enter from text inputs or textareas
    const tag = e.target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SL-TEXTAREA' || tag === 'INPUT' || tag === 'SL-INPUT') return;
    if (e.target?.tagName === 'SL-BUTTON' || e.target?.tagName === 'BUTTON') return;
    e.preventDefault();
    this.#handleSave();
  };

  async open() {
    await this.updateComplete;
    this.#clearValidation();
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;
    await dialog.show();
    this.querySelector('.dialog-add-edit-input-name')?.focus();
  }

  async openEdit(id, name, pages) {
    await this.updateComplete;
    this.#clearValidation();
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    inputId.value = id;
    inputName.value = name;

    await customElements.whenDefined('copio-images');
    copioImages.images = pages.map(({ id, src, originalSrc, edits, exif, type, name, content }) => ({
      id,
      src,
      originalSrc: originalSrc || src,
      edits: edits || { crop: null, rotation: 0, filter: 'none' },
      exif,
      type,
      name,
      content,
    }));

    if (!dialog.open) {
      await dialog.show();
      inputName.focus();
    }
  }

  #handleSave = () => {
    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const nameError = this.querySelector('.dialog-name-error');
    const copioImages = this.querySelector('copio-images');

    const name = inputName?.value?.trim();
    if (!name) {
      if (nameError) {
        nameError.style.display = 'block';
      }
      if (inputName) {
        inputName.classList.add('input-invalid');
        inputName.style.setProperty('--sl-input-border-color', '#ef4444');
        inputName.style.setProperty('--sl-input-border-color-focus', '#ef4444');
        if (typeof inputName.setCustomValidity === 'function') {
          inputName.setCustomValidity('Please enter a document name');
          inputName.reportValidity?.();
        }
        inputName.focus();
      }
      return;
    }

    const pages = (copioImages?.images || []).map(({ id, src, originalSrc, edits, exif, type, name, content }) => ({
      id,
      src,
      originalSrc: originalSrc || src,
      edits: edits || { crop: null, rotation: 0, filter: 'none' },
      exif,
      type,
      name,
      content,
    }));

    const id = inputId?.value || randomId();

    this.dispatchEvent(new CustomEvent('dialog:save', {
      bubbles: true,
      composed: false,
      detail: { id, name, pages }
    }));

    this.querySelector('.dialog-add-edit')?.hide();
  };

  render() {
    return html`
      <sl-dialog
        label="Add / Edit"
        class="dialog-add-edit"
        style="--width: min(94%, 640px)"
        @sl-after-hide=${this.#handleHide}
        @keydown=${this.#handleKeydown}
      >
        <div style="min-height: min(65cqh, 420px); min-height: 350px;">
          <sl-input
            disabled
            class="dialog-add-edit-input-id"
            placeholder="id"
            style="display: none"
          ></sl-input>
          <div class="dialog-name-field" style="max-width: 300px">
            <sl-input
              class="dialog-add-edit-input-name"
              placeholder="Enter name of document or image"
              @sl-input=${this.#handleNameInput}
            ></sl-input>
            <div
              class="dialog-name-error"
              style="color: #ef4444; font-size: 0.8rem; margin-top: 4px; display: none;"
            >
              Please enter a document name
            </div>
            <sl-button
              size="small"
              variant="neutral"
              outline
              class="dialog-scan-camera-btn"
              style="margin-top: 8px;"
              @click=${this.#handleScanClick}
            >
              <sl-icon slot="prefix" name="camera"></sl-icon>
              Scan with Camera
            </sl-button>
          </div>

          <copio-images
            style="display: block; margin-top: 1.5rem"
          ></copio-images>

          <sl-dialog
            label="Scan Pages"
            class="dialog-inner-scanner"
            style="--width: min(94%, 600px); --sl-panel-background-color: #0b0f17;"
          >
            <div class="copio-scanner-host" style="width: 100%; height: 420px; display: flex;">
              <copio-scanner
                class="inner-copio-scanner"
                mode="batch"
                aspect="auto"
                theme="dark"
                @copio:scan-complete=${this.#handleInnerScanComplete}
              ></copio-scanner>
            </div>
          </sl-dialog>

          <br />

          <sl-button
            class="dialog-add-edit-savebtn"
            style="width: 100%; margin-top: auto;"
            slot="footer"
            variant="primary"
            @click=${this.#handleSave}
            >Save</sl-button
          >
        </div>
      </sl-dialog>
    `;
  }
}

customElements.define('copio-add-edit-dialog', CopioAddEditDialog);
