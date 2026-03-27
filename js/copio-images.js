/*
this doesn't convert nicely to lit-html
The issue is a fundamental incompatibility between Sortable and lit-html. When Sortable physically moves a DOM node, it moves the element but
leaves lit-html's comment markers (used to track ChildParts) in their original positions. On re-render, lit-html finds an empty slot where
the element was and creates a duplicate — the moved node becomes orphaned.
*/

// the images attr is an array of objects, e.g. [{ id: ..., src: ... }]
// this component creates ids for new images

// Import PDF.js for PDF processing
import * as pdfjsLib from './pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdf.worker.min.mjs';

import Sortable from './sortable.esm.js';
import { randomId, fileToBase64, rotateSrc, thresholdSrc, extractExif } from './utils.js';

class CopioImages extends HTMLElement {
  #images = [];
  #cropper = null;
  #cropIndex = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['images'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'images') {
      try {
        this.#images = JSON.parse(newValue) || [];
      } catch {
        this.#images = [];
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const styles = `
      <link rel="stylesheet" href="css/cropper.css">
      <style>
        .container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.75rem;
          max-width: 100%;
        }
        @media (min-width: 640px) {
          .container {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .container {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .image-wrapper {
          cursor: grab;
          position: relative;
          user-select: none;
          -webkit-user-select: none;
          width: 100%;
          aspect-ratio: 1;
        }
        .image-wrapper:active {
          cursor: grabbing;
        }
        .image-wrapper.dragging {
          opacity: 0.4;
          cursor: grabbing;
        }
        .image-wrapper.sortable-ghost {
          opacity: 0.2;
        }
        .image-menu {
          position: absolute;
          top: 4px;
          right: 4px;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border: 1px solid #ccc;
          border-radius: 4px;
          display: block;
        }
        #crop-image {
          max-width: 100%;
          max-height: 60vh;
        }
        button.add-btn {
          width: 100%;
          aspect-ratio: 1;
          font-size: 2rem;
          border: 2px dashed #888;
          border-radius: 4px;
          background: none;
          cursor: pointer;
        }
        dialog {
          border: none;
          border-radius: 6px;
          padding: 1rem;
        }
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.3);
        }
      </style>
    `;

    const imageHtml = this.#images
      .map(
        ({ src }, index) => `
        <div class="image-wrapper" data-index="${index}">
          <img src="${src}" draggable="false">
          <sl-dropdown class="image-menu" data-index="${index}">
            <sl-button slot="trigger" variant="default" size="small" circle>
              <sl-icon name="three-dots-vertical"></sl-icon>
            </sl-button>
            <sl-menu>
              <sl-menu-item value="crop">Crop</sl-menu-item>
              <sl-menu-item value="rotate">Rotate</sl-menu-item>
              <sl-menu-item value="threshold">Black &amp; White</sl-menu-item>
              <sl-menu-item value="showdata">Show Data</sl-menu-item>
              <sl-divider></sl-divider>
              <sl-menu-item value="delete">Delete</sl-menu-item>
            </sl-menu>
          </sl-dropdown>
        </div>
      `,
      )
      .join('');

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="container">
        ${imageHtml}
        <button class="add-btn" title="Add Image">+</button>
      </div>

      <sl-dialog label="Select image(s) or PDF to upload" class="upload-dialog">
        <input type="file" accept="image/*,application/pdf" multiple>
        <sl-button
          slot="footer"
          variant="primary"
          class="close"
          >Close</sl-button
        >
      </sl-dialog>

      <sl-dialog label="Image Data" class="data-dialog">
        <div class="exif-data" style="font-size: 0.85rem; line-height: 1.6;"></div>
        <sl-button slot="footer" variant="primary" class="close-data">Close</sl-button>
      </sl-dialog>

      <sl-dialog label="Crop Image" class="crop-dialog" style="--width: 80vw">
        <div style="margin-bottom: 1rem;">
          <img id="crop-image" />
        </div>
        <sl-button
          slot="footer"
          variant="default"
          class="cancel-crop"
          >Cancel</sl-button
        >
        <sl-button
          slot="footer"
          variant="primary"
          class="apply-crop"
          >Apply</sl-button
        >
      </sl-dialog>
      `;

    this.shadowRoot.querySelector('.add-btn').onclick = () => {
      this.shadowRoot.querySelector('.upload-dialog').show();
    };

    this.shadowRoot.querySelector('.close').onclick = () => {
      this.shadowRoot.querySelector('.upload-dialog').hide();
    };

    this.shadowRoot.querySelector('.close-data').onclick = () => {
      this.shadowRoot.querySelector('.data-dialog').hide();
    };

    this.shadowRoot.querySelector('input[type="file"]').onchange = async (
      event,
    ) => {
      const files = Array.from(event.target.files);
      const allImages = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          // Process PDF: extract each page as an image
          const pdfImages = await this.pdfToImages(file);
          allImages.push(...pdfImages);
        } else {
          // Process regular image
          const [src, exif] = await Promise.all([fileToBase64(file), extractExif(file)]);
          allImages.push({
            id: randomId(),
            src,
            exif,
          });
        }
      }

      this.#images.push(...allImages);
      this.setAttribute('images', JSON.stringify(this.#images));
    };

    // Setup crop menu handlers
    this.shadowRoot.querySelectorAll('.image-menu').forEach((dropdown) => {
      const menu = dropdown.querySelector('sl-menu');
      menu.addEventListener('sl-select', (event) => {
        event.stopPropagation();
        const index = parseInt(dropdown.dataset.index);
        if (event.detail.item.value === 'crop') {
          dropdown.hide();
          this.openCropDialog(index);
        } else if (event.detail.item.value === 'rotate') {
          this.rotateImage(index);
        } else if (event.detail.item.value === 'threshold') {
          this.thresholdImage(index);
        } else if (event.detail.item.value === 'showdata') {
          dropdown.hide();
          this.showImageData(index);
        } else if (event.detail.item.value === 'delete') {
          this.#images.splice(index, 1);
          this.setAttribute('images', JSON.stringify(this.#images));
        }
      });
    });

    // Setup crop dialog buttons
    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');

    this.shadowRoot.querySelector('.cancel-crop').onclick = () => {
      this.closeCropDialog();
    };

    this.shadowRoot.querySelector('.apply-crop').onclick = () => {
      this.applyCrop();
    };

    // Clean up when dialog is closed by any means (ESC, overlay click, etc)
    cropDialog.addEventListener('sl-hide', () => {
      if (this.#cropper) {
        this.#cropper.destroy();
        this.#cropper = null;
      }
      this.#cropIndex = null;
    });

    this.#setupSortable();
  }

  #setupSortable() {
    const container = this.shadowRoot.querySelector('.container');

    Sortable.create(container, {
      animation: 150,
      draggable: '.image-wrapper',
      chosenClass: 'dragging',
      ghostClass: 'sortable-ghost',
      filter: 'sl-dropdown',
      preventOnFilter: false,
      onEnd: (evt) => {
        if (evt.to !== container) return;
        const oldIdx = evt.oldDraggableIndex;
        const newIdx = evt.newDraggableIndex;
        if (oldIdx === newIdx) return;
        const dragged = this.#images[oldIdx];
        this.#images.splice(oldIdx, 1);
        this.#images.splice(newIdx, 0, dragged);
        this.setAttribute('images', JSON.stringify(this.#images));
      },
    });
  }

  openCropDialog(index) {
    this.#cropIndex = index;
    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');
    const cropImage = this.shadowRoot.querySelector('#crop-image');

    cropImage.src = this.#images[index].src;
    cropDialog.show();

    // Wait for image to load and dialog to be visible
    cropImage.onload = () => {
      if (this.#cropper) {
        this.#cropper.destroy();
      }
      this.#cropper = new Cropper(cropImage, {
        viewMode: 1,
        autoCropArea: 1,
      });
    };
  }

  closeCropDialog() {
    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');
    if (this.#cropper) {
      this.#cropper.destroy();
      this.#cropper = null;
    }
    this.#cropIndex = null;
    cropDialog.hide();
  }

  applyCrop() {
    if (this.#cropper && this.#cropIndex !== null) {
      const canvas = this.#cropper.getCroppedCanvas();
      const croppedSrc = canvas.toDataURL();

      // Update the image
      this.#images[this.#cropIndex].src = croppedSrc;
      this.setAttribute('images', JSON.stringify(this.#images));

      this.closeCropDialog();
    }
  }

  async rotateImage(index) {
    const rotatedSrc = await rotateSrc(this.#images[index].src);
    this.#images[index].src = rotatedSrc;
    this.setAttribute('images', JSON.stringify(this.#images));
  }

  async thresholdImage(index) {
    const thresholdedSrc = await thresholdSrc(this.#images[index].src);
    this.#images[index].src = thresholdedSrc;
    this.setAttribute('images', JSON.stringify(this.#images));
  }

  showImageData(index) {
    const { src, exif } = this.#images[index];
    const img = this.shadowRoot.querySelector(`img[src="${src}"]`);
    const rows = [];
    rows.push(`<strong>Dimensions:</strong> ${img ? `${img.naturalWidth} × ${img.naturalHeight}` : 'unknown'}`);
    if (exif) {
      const skip = new Set(['MakerNote', 'UserComment', 'FlashPixVersion', 'ExifVersion', 'ComponentsConfiguration', 'SceneType', 'thumbnail']);
      for (const [key, val] of Object.entries(exif)) {
        if (skip.has(key) || val === undefined || val === null) continue;
        let display = val instanceof Array ? val.join(', ') : String(val);
        if (display.length > 200) continue;
        rows.push(`<strong>${key}:</strong> ${display}`);
      }
    } else {
      rows.push('<em>No EXIF data available</em>');
    }
    this.shadowRoot.querySelector('.exif-data').innerHTML = rows.join('<br>');
    this.shadowRoot.querySelector('.data-dialog').show();
  }

  async pdfToImages(file) {
    const images = [];

    // Read PDF file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      // Set scale for good quality (2x for retina displays)
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      // Create canvas to render the page
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render the page
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert canvas to base64 image
      const src = canvas.toDataURL('image/png');

      images.push({
        id: randomId(),
        src,
      });
    }

    return images;
  }

  get images() {
    return this.#images;
  }

  set images(val) {
    this.#images = val;
    this.setAttribute('images', JSON.stringify(val));
  }
}

customElements.define('copio-images', CopioImages);
