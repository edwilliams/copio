/*
this doesn't convert nicely to lit-html
The issue is a fundamental incompatibility between Sortable and lit-html. When Sortable physically moves a DOM node, it moves the element but
leaves lit-html's comment markers (used to track ChildParts) in their original positions. On re-render, lit-html finds an empty slot where
the element was and creates a duplicate — the moved node becomes orphaned.
*/

import Sortable from './lib/sortable.esm.js';
import { randomId, fileToBase64, rotateSrc, thresholdSrc, extractExif, getCroppedSrc } from './utils.js';
import { renderPdfPagesToDataUrls } from './pdf-utils.js';
import { recognizeImageText, SUPPORTED_LANGUAGES } from './ocr-service.js';

class CopioImages extends HTMLElement {
  #images = [];
  #cropper = null;
  #cropIndex = null;
  #textIndex = null;
  #ocrIndex = null;
  #ocrLang = 'eng';
  #ocrResult = null;
  #isInitialized = false;

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
      if (this.#isInitialized) {
        this.#renderGrid();
      }
    }
  }

  connectedCallback() {
    if (!this.#isInitialized) {
      this.#initShell();
      this.#isInitialized = true;
    }
    this.#renderGrid();
  }

  #initShell() {
    const langOptions = SUPPORTED_LANGUAGES.map(
      (l) => `<sl-option value="${l.code}">${l.flag} ${l.label}</sl-option>`,
    ).join('');

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
        .markdown-card {
          width: 100%;
          height: 100%;
          border: 1px solid #334155;
          border-radius: 4px;
          background: #0f172a;
          color: #f8fafc;
          padding: 10px;
          box-sizing: border-box;
          font-family: monospace;
          font-size: 0.72rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .markdown-card-header {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: bold;
          font-size: 0.75rem;
          color: #38bdf8;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .markdown-card-body {
          flex: 1;
          opacity: 0.8;
          word-break: break-word;
          overflow: hidden;
          line-height: 1.35;
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
        .ocr-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .ocr-progress-box {
          padding: 2rem 1rem;
          text-align: center;
        }
        .ocr-status-text {
          font-size: 1rem;
          margin-bottom: 1rem;
          color: #0284c7;
          font-weight: 600;
        }
        .ocr-subtext {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.6rem;
        }
        .ocr-stats {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
          color: #64748b;
          margin-top: 0.5rem;
          padding: 0 4px;
        }
      </style>
    `;

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="container"></div>

      <sl-dialog label="Select image(s), PDF, or Markdown to upload" class="upload-dialog">
        <input type="file" accept="image/*,application/pdf,.md,.markdown,text/plain" multiple>
        <sl-button slot="footer" variant="primary" class="close">Close</sl-button>
      </sl-dialog>

      <sl-dialog label="Edit Markdown Text" class="text-dialog" style="--width: 80vw">
        <div style="margin-bottom: 1rem;">
          <sl-textarea class="text-editor" rows="12" placeholder="Enter markdown content..."></sl-textarea>
        </div>
        <sl-button slot="footer" variant="default" class="cancel-text">Cancel</sl-button>
        <sl-button slot="footer" variant="primary" class="apply-text">Save Text</sl-button>
      </sl-dialog>

      <sl-dialog label="Image Data" class="data-dialog">
        <div class="exif-data" style="font-size: 0.85rem; line-height: 1.6;"></div>
        <sl-button slot="footer" variant="primary" class="close-data">Close</sl-button>
      </sl-dialog>

      <sl-dialog label="Crop Image" class="crop-dialog" style="--width: 80vw">
        <div style="margin-bottom: 1rem;">
          <img id="crop-image" />
        </div>
        <sl-button slot="footer" variant="default" class="cancel-crop">Cancel</sl-button>
        <sl-button slot="footer" variant="primary" class="apply-crop">Apply</sl-button>
      </sl-dialog>

      <sl-dialog label="Text Recognition (OCR)" class="ocr-dialog" style="--width: 85vw">
        <div class="ocr-controls">
          <div style="display: flex; align-items: center; gap: 8px;">
            <sl-select class="ocr-lang-select" size="small" value="eng" style="min-width: 190px;">
              ${langOptions}
            </sl-select>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <sl-badge variant="neutral" class="ocr-page-badge">Page 1</sl-badge>
            <sl-badge variant="success" class="ocr-confidence-badge" style="display: none;"></sl-badge>
          </div>
        </div>

        <div class="ocr-progress-box">
          <div class="ocr-status-text">Starting OCR...</div>
          <sl-progress-bar class="ocr-progress-bar" value="0"></sl-progress-bar>
          <div class="ocr-subtext">Client-side WebAssembly OCR with zero server upload</div>
        </div>

        <div class="ocr-result-box" style="display: none;">
          <sl-textarea class="ocr-text-editor" rows="12" placeholder="Extracted text..."></sl-textarea>
          <div class="ocr-stats">
            <span class="ocr-word-count">0 words</span>
            <span class="ocr-char-count">0 characters</span>
          </div>
        </div>

        <sl-button slot="footer" variant="default" class="ocr-close-btn">Close</sl-button>
        <sl-button slot="footer" variant="default" class="ocr-copy-btn" style="display: none;">
          <sl-icon slot="prefix" name="clipboard"></sl-icon> Copy Text
        </sl-button>
        <sl-button slot="footer" variant="primary" class="ocr-add-md-btn" style="display: none;">
          <sl-icon slot="prefix" name="file-earmark-plus"></sl-icon> Add as Note Page
        </sl-button>
      </sl-dialog>
    `;

    this.shadowRoot.querySelector('.close').onclick = () => {
      this.shadowRoot.querySelector('.upload-dialog').hide();
    };

    this.shadowRoot.querySelector('.close-data').onclick = () => {
      this.shadowRoot.querySelector('.data-dialog').hide();
    };

    this.shadowRoot.querySelector('input[type="file"]').onchange = async (event) => {
      const files = Array.from(event.target.files);
      const allImages = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          const pdfImages = await this.pdfToImages(file);
          allImages.push(...pdfImages);
        } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type === 'text/markdown' || file.type === 'text/plain') {
          const content = await file.text();
          allImages.push({
            id: randomId(),
            type: 'markdown',
            name: file.name,
            content,
          });
        } else {
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

    const cropDialog = this.shadowRoot.querySelector('.crop-dialog');
    this.shadowRoot.querySelector('.cancel-crop').onclick = () => this.closeCropDialog();
    this.shadowRoot.querySelector('.apply-crop').onclick = () => this.applyCrop();
    this.shadowRoot.querySelector('.cancel-text').onclick = () => this.closeTextDialog();
    this.shadowRoot.querySelector('.apply-text').onclick = () => this.applyTextEdit();

    cropDialog.addEventListener('sl-hide', () => {
      if (this.#cropper) {
        this.#cropper.destroy();
        this.#cropper = null;
      }
      this.#cropIndex = null;
    });

    // OCR Dialog Event Listeners
    const ocrDialog = this.shadowRoot.querySelector('.ocr-dialog');
    const ocrLangSelect = this.shadowRoot.querySelector('.ocr-lang-select');
    const ocrCloseBtn = this.shadowRoot.querySelector('.ocr-close-btn');
    const ocrCopyBtn = this.shadowRoot.querySelector('.ocr-copy-btn');
    const ocrAddMdBtn = this.shadowRoot.querySelector('.ocr-add-md-btn');

    ocrCloseBtn.onclick = () => this.closeOcrDialog();
    ocrCopyBtn.onclick = () => this.copyOcrText();
    ocrAddMdBtn.onclick = () => this.addOcrAsMarkdownPage();

    ocrLangSelect.addEventListener('sl-change', (e) => {
      this.#ocrLang = e.target.value;
      if (this.#ocrIndex !== null) {
        this.runOcr(this.#ocrIndex, this.#ocrLang);
      }
    });

    ocrDialog.addEventListener('sl-hide', () => {
      this.#ocrIndex = null;
      this.#ocrResult = null;
    });
  }

  #renderGrid() {
    const container = this.shadowRoot.querySelector('.container');
    if (!container) return;

    const imageHtml = this.#images
      .map((item, index) => {
        if (item.type === 'markdown') {
          const title = item.name || 'Markdown Note';
          const snippet = (item.content || '').slice(0, 120);
          return `
            <div class="image-wrapper" data-index="${index}">
              <div class="markdown-card">
                <div class="markdown-card-header">
                  <sl-icon name="file-earmark-text"></sl-icon> ${title}
                </div>
                <div class="markdown-card-body">${snippet}</div>
              </div>
              <sl-dropdown class="image-menu" data-index="${index}">
                <sl-button slot="trigger" variant="default" size="small" circle>
                  <sl-icon name="three-dots-vertical"></sl-icon>
                </sl-button>
                <sl-menu>
                  <sl-menu-item value="edittext">Edit Text</sl-menu-item>
                  <sl-menu-item value="download">Download Markdown</sl-menu-item>
                  <sl-divider></sl-divider>
                  <sl-menu-item value="delete">Delete</sl-menu-item>
                </sl-menu>
              </sl-dropdown>
            </div>
          `;
        }
        return `
          <div class="image-wrapper" data-index="${index}">
            <img src="${item.src}" draggable="false">
            <sl-dropdown class="image-menu" data-index="${index}">
              <sl-button slot="trigger" variant="default" size="small" circle>
                <sl-icon name="three-dots-vertical"></sl-icon>
              </sl-button>
              <sl-menu>
                <sl-menu-item value="ocr">
                  <sl-icon slot="prefix" name="card-text"></sl-icon> Extract Text (OCR)
                </sl-menu-item>
                <sl-divider></sl-divider>
                <sl-menu-item value="crop">Crop</sl-menu-item>
                <sl-menu-item value="rotate">Rotate</sl-menu-item>
                <sl-menu-item value="threshold">Black &amp; White</sl-menu-item>
                <sl-menu-item value="showdata">Show Data</sl-menu-item>
                <sl-menu-item value="download">Download Image</sl-menu-item>
                <sl-divider></sl-divider>
                <sl-menu-item value="delete">Delete</sl-menu-item>
              </sl-menu>
            </sl-dropdown>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      ${imageHtml}
      <button class="add-btn" title="Add Image">+</button>
    `;

    container.querySelector('.add-btn').onclick = () => {
      this.shadowRoot.querySelector('.upload-dialog').show();
    };

    container.querySelectorAll('.image-menu').forEach((dropdown) => {
      const menu = dropdown.querySelector('sl-menu');
      menu.addEventListener('sl-select', (event) => {
        event.stopPropagation();
        const index = parseInt(dropdown.dataset.index);
        const action = event.detail.item.value;

        if (action === 'ocr') {
          dropdown.hide();
          this.openOcrDialog(index);
        } else if (action === 'crop') {
          dropdown.hide();
          this.openCropDialog(index);
        } else if (action === 'rotate') {
          this.rotateImage(index);
        } else if (action === 'threshold') {
          this.thresholdImage(index);
        } else if (action === 'showdata') {
          dropdown.hide();
          this.showImageData(index);
        } else if (action === 'edittext') {
          dropdown.hide();
          this.openTextDialog(index);
        } else if (action === 'download') {
          this.downloadImage(index);
        } else if (action === 'delete') {
          this.#images.splice(index, 1);
          this.setAttribute('images', JSON.stringify(this.#images));
        }
      });
    });

    this.#setupSortable(container);
  }

  #setupSortable(container) {
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
      const originalSrc = this.#images[this.#cropIndex]?.src || '';
      const croppedSrc = getCroppedSrc(this.#cropper, originalSrc);

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

  // OCR Methods
  openOcrDialog(index) {
    this.#ocrIndex = index;
    const ocrDialog = this.shadowRoot.querySelector('.ocr-dialog');
    const pageBadge = this.shadowRoot.querySelector('.ocr-page-badge');
    const confidenceBadge = this.shadowRoot.querySelector('.ocr-confidence-badge');

    pageBadge.textContent = `Page ${index + 1}`;
    confidenceBadge.style.display = 'none';

    ocrDialog.show();
    this.runOcr(index, this.#ocrLang);
  }

  closeOcrDialog() {
    const ocrDialog = this.shadowRoot.querySelector('.ocr-dialog');
    this.#ocrIndex = null;
    this.#ocrResult = null;
    ocrDialog.hide();
  }

  async runOcr(index, lang = 'eng') {
    const page = this.#images[index];
    if (!page || !page.src) return;

    const progressBox = this.shadowRoot.querySelector('.ocr-progress-box');
    const resultBox = this.shadowRoot.querySelector('.ocr-result-box');
    const statusText = this.shadowRoot.querySelector('.ocr-status-text');
    const progressBar = this.shadowRoot.querySelector('.ocr-progress-bar');
    const confidenceBadge = this.shadowRoot.querySelector('.ocr-confidence-badge');
    const copyBtn = this.shadowRoot.querySelector('.ocr-copy-btn');
    const addMdBtn = this.shadowRoot.querySelector('.ocr-add-md-btn');
    const textEditor = this.shadowRoot.querySelector('.ocr-text-editor');
    const wordCount = this.shadowRoot.querySelector('.ocr-word-count');
    const charCount = this.shadowRoot.querySelector('.ocr-char-count');

    progressBox.style.display = 'block';
    resultBox.style.display = 'none';
    copyBtn.style.display = 'none';
    addMdBtn.style.display = 'none';
    confidenceBadge.style.display = 'none';
    progressBar.value = 0;
    statusText.textContent = 'Initializing WebAssembly OCR engine...';

    try {
      const result = await recognizeImageText(page.src, {
        lang,
        onProgress: ({ progress, message }) => {
          progressBar.value = Math.round((progress || 0) * 100);
          statusText.textContent = message || 'Processing...';
        },
      });

      this.#ocrResult = result;
      textEditor.value = result.text || '';

      const words = (result.text || '').trim().split(/\s+/).filter(Boolean).length;
      const chars = (result.text || '').length;
      wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
      charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;

      confidenceBadge.textContent = `${result.confidence}% Confidence`;
      confidenceBadge.variant = result.confidence >= 75 ? 'success' : result.confidence >= 50 ? 'warning' : 'danger';
      confidenceBadge.style.display = 'inline-block';

      progressBox.style.display = 'none';
      resultBox.style.display = 'block';
      copyBtn.style.display = 'inline-flex';
      addMdBtn.style.display = 'inline-flex';
    } catch (err) {
      console.error('OCR recognition error:', err);
      statusText.textContent = `OCR Error: ${err.message || 'Recognition failed'}`;
      statusText.style.color = '#ef4444';
      progressBar.value = 0;
    }
  }

  async copyOcrText() {
    const textEditor = this.shadowRoot.querySelector('.ocr-text-editor');
    const copyBtn = this.shadowRoot.querySelector('.ocr-copy-btn');
    const text = textEditor.value || '';

    try {
      await navigator.clipboard.writeText(text);
      const origHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = '<sl-icon slot="prefix" name="check"></sl-icon> Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = origHtml;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
    }
  }

  addOcrAsMarkdownPage() {
    const textEditor = this.shadowRoot.querySelector('.ocr-text-editor');
    const text = textEditor.value || '';
    if (!text.trim()) return;

    const pageIndex = this.#ocrIndex !== null ? this.#ocrIndex : this.#images.length - 1;
    const pageNumber = pageIndex + 1;

    const newMarkdownPage = {
      id: randomId(),
      type: 'markdown',
      name: `OCR - Page ${pageNumber}`,
      content: text,
    };

    // Insert right after the image
    this.#images.splice(pageIndex + 1, 0, newMarkdownPage);
    this.setAttribute('images', JSON.stringify(this.#images));
    this.closeOcrDialog();
  }

  downloadImage(index) {
    const page = this.#images[index];
    if (!page) return;
    if (page.type === 'markdown') {
      const blob = new Blob([page.content || ''], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = page.name || `document-${index + 1}.md`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!page.src) return;
    let ext = 'jpg';
    if (page.src.startsWith('data:')) {
      const match = page.src.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      if (match && match[1].includes('png')) ext = 'png';
    }
    const a = document.createElement('a');
    a.href = page.src;
    a.download = `image-${index + 1}.${ext}`;
    a.click();
  }

  openTextDialog(index) {
    this.#textIndex = index;
    const textDialog = this.shadowRoot.querySelector('.text-dialog');
    const textEditor = this.shadowRoot.querySelector('.text-editor');
    textEditor.value = this.#images[index].content || '';
    textDialog.show();
  }

  applyTextEdit() {
    if (this.#textIndex !== null && this.#images[this.#textIndex]) {
      const textEditor = this.shadowRoot.querySelector('.text-editor');
      this.#images[this.#textIndex].content = textEditor.value;
      this.setAttribute('images', JSON.stringify(this.#images));
      this.closeTextDialog();
    }
  }

  closeTextDialog() {
    const textDialog = this.shadowRoot.querySelector('.text-dialog');
    this.#textIndex = null;
    textDialog.hide();
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
    const arrayBuffer = await file.arrayBuffer();
    const dataUrls = await renderPdfPagesToDataUrls(arrayBuffer);
    return dataUrls.map((src) => ({
      id: randomId(),
      src,
    }));
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
