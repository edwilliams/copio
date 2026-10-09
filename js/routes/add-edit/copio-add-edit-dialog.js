import { LitElement, html } from '../../lib/lit-core.min.js';
import { randomId } from '../../utils/utils.js';

class CopioAddEditDialog extends LitElement {
  createRenderRoot() {
    return this;
  }

  #handleHide = (event) => {
    if (event.target !== event.currentTarget) return;
    
    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    if (inputId) inputId.value = '';
    if (inputName) inputName.value = '';
    if (copioImages) copioImages.images = [];
    
    this.dispatchEvent(new CustomEvent('copio-add-edit-dialog:hide', { bubbles: true }));
  };

  #handleKeydown = (e) => {
    if (e.key !== 'Enter') return;
    // Don't intercept Enter when a nested dialog/modal is open (note editor, cropper, etc.)
    if (this.querySelector('sl-dialog[open]')) return;
    // Don't intercept Enter from text inputs or textareas
    const tag = e.target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SL-TEXTAREA' || tag === 'INPUT' || tag === 'SL-INPUT') return;
    if (e.target?.tagName === 'SL-BUTTON' || e.target?.tagName === 'BUTTON') return;
    e.preventDefault();
    this.#handleSave();
  };

  async open() {
    await this.updateComplete;
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;
    await dialog.show();
    this.querySelector('.dialog-add-edit-input-name')?.focus();
  }

  async openEdit(id, name, pages) {
    await this.updateComplete;
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;

    // If the dialog is still open (e.g. mid-close animation), wait for it to finish
    if (dialog.open) {
      await new Promise((resolve) => dialog.addEventListener('sl-after-hide', resolve, { once: true }));
    }

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    inputId.value = id;
    inputName.value = name;

    await customElements.whenDefined('copio-images');
    copioImages.images = pages.map(({ id, src, exif, type, name, content }) => ({ id, src, exif, type, name, content }));

    await dialog.show();
    inputName.focus();
  }

  #handleSave = () => {
    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    if (!inputName.value) {
      const name = prompt('Please enter a name');
      if (!name) return;
      inputName.value = name;
    }

    const pages = copioImages.images.map(({ id, src, exif, type, name, content }) => ({
      id,
      src,
      exif,
      type,
      name,
      content,
    }));

    const id = inputId?.value || randomId();

    this.dispatchEvent(new CustomEvent('copio-add-edit-dialog:save', {
      bubbles: true,
      detail: { id, name: inputName.value, pages }
    }));

    this.querySelector('.dialog-add-edit').hide();
  };

  render() {
    return html`
      <sl-dialog
        label="Add / Edit"
        class="dialog-add-edit"
        style="--width: 90vw"
        @sl-after-hide=${this.#handleHide}
        @keydown=${this.#handleKeydown}
      >
        <div class="relative" style="min-height: 65vh">
          <sl-input
            disabled
            class="dialog-add-edit-input-id"
            placeholder="id"
            style="display: none"
          ></sl-input>
          <sl-input
            class="dialog-add-edit-input-name"
            placeholder="Enter name of document or image"
            style="max-width: 300px"
          ></sl-input>

          <copio-images
            style="display: block; margin-top: 1.5rem"
          ></copio-images>

          <br />

          <sl-button
            class="dialog-add-edit-savebtn abm w-full"
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
