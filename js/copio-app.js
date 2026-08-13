import { LitElement, html } from './lib/lit-core.min.js';
import { SimpleRouter } from './router.js';
import { randomId } from './utils.js';
import { createStore } from './lib/tinybase.6.5.2.js';
import { createIndexedDbPersister } from './lib/tinybase-persister-indexed-db.js';
import { exportDocumentAsPdf, exportDocumentAsImages, exportDocumentAsMarkdown } from './export-utils.js';
import { SyncManager } from './sync-service.js';
import { recognizeDocumentPages, SUPPORTED_LANGUAGES } from './ocr-service.js';

class CopioApp extends LitElement {
  #syncManager = null;
  #router = null;

  static properties = {
    docsData: { type: Object, state: true },
    showCarousel: { type: Boolean, state: true },
    syncState: { type: Object, state: true },
    ocrDocState: { type: Object, state: true },
  };

  createRenderRoot() {
    return this; // Use Light DOM (not Shadow DOM) for Shoelace compatibility
  }

  constructor() {
    super();

    // Initialize reactive state
    this.docsData = {};
    this.showCarousel = false;
    this.syncState = null;
    this.ocrDocState = null;
    this.hideLoaderTimer = null;

    // Setup TinyBase store
    this.store = createStore();
    this.store.setTable('docs', {});

    this.persister = createIndexedDbPersister(this.store, 'copio-db');
    this.persister.startAutoLoad();
    this.persister.startAutoSave();

    // Bridge TinyBase reactivity to Lit
    this.store.addTableListener('docs', () => {
      this.docsData = this.store.getTable('docs');
      const currentPath = this.#router?.getHashPath() || '';
      if (currentPath.startsWith('/doc/')) {
        this.#router.handleRoute();
      }
    });

    // Initialize PeerJS sync service
    this.#syncManager = new SyncManager(this.store, (state) => {
      this.syncState = state;
    });

    // Initialize Zero-Dependency Hash Router
    this.#router = new SimpleRouter([
      {
        path: '/',
        render: () => {
          this.showCarousel = false;
        },
      },
      {
        path: '/add',
        render: () => {
          this.showCarousel = false;
          setTimeout(() => this.#openAddDialog(), 50);
        },
      },
      {
        path: '/doc/:id',
        render: ({ id }) => {
          this.#loadCarouselDoc(id);
        },
      },
      {
        path: '/doc/:id/edit',
        render: ({ id }) => {
          this.showCarousel = false;
          setTimeout(() => this.#loadEditDoc(id), 50);
        },
      },
      {
        path: '/sync',
        render: () => {
          this.showCarousel = false;
          setTimeout(() => this.#syncManager.startHost(), 50);
        },
      },
      {
        path: '/sync/:peer',
        render: ({ peer }) => {
          this.showCarousel = false;
          setTimeout(() => this.#syncManager.startJoiner(peer), 50);
        },
      },
    ]);
  }

  #navigate(path) {
    this.#router.navigate(path);
  }

  // Runs after first render - replaces connectedCallback
  firstUpdated() {
    this.hideLoader();

    // Load persisted data - triggers TinyBase listener → updates docsData → Lit re-renders
    this.persister.load();

    const peerId = new URLSearchParams(window.location.search).get('peer');
    if (peerId) {
      history.replaceState({}, '', window.location.pathname);
      this.#navigate(`/sync/${peerId}`);
    } else {
      this.#router.handleRoute();
    }
  }

  // Cleanup
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.hideLoaderTimer);
    this.#syncManager?.close();
  }

  hideLoader() {
    this.hideLoaderTimer = setTimeout(() => {
      const loader = this.querySelector('copio-loader');
      if (loader) {
        loader.style.display = 'none';
      }
      this.hideLoaderTimer = null;
    }, 800);
  }

  #handleDialogKeydown = (e) => {
    if (e.key === 'Enter') {
      if (e.target?.tagName === 'SL-BUTTON' || e.target?.tagName === 'BUTTON') return;
      e.preventDefault();
      this.handleAddEditSave();
    }
  };

  #openAddDialog() {
    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;
    dialog.show();
    setTimeout(() => {
      this.querySelector('.dialog-add-edit-input-name')?.focus();
    }, 100);
  }

  handleAddNew() {
    this.#navigate('/add');
  }

  handleAddEditSave() {
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

    this.store.setRow('docs', id, {
      name: inputName.value,
      pages: JSON.stringify(pages),
    });

    this.querySelector('.dialog-add-edit').hide();
    this.#navigate('/');
  }

  handleAddEditHide(event) {
    if (event.target !== event.currentTarget) return;

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    inputId.value = '';
    inputName.value = '';
    copioImages.images = [];

    if (this.#router.getHashPath() !== '/') {
      this.#navigate('/');
    }
  }

  async #loadEditDoc(id) {
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const dialog = this.querySelector('.dialog-add-edit');
    if (!dialog) return;
    dialog.show();

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    inputId.value = id;
    inputName.value = vals.name;
    setTimeout(() => {
      inputName.focus();
    }, 100);

    await customElements.whenDefined('copio-images');
    const pages = JSON.parse(vals.pages || '[]');
    copioImages.images = pages.map(({ id, src, exif, type, name, content }) => ({ id, src, exif, type, name, content }));
  }

  handleRowEdit(e) {
    const id = e.detail?.id;
    if (id) this.#navigate(`/doc/${id}/edit`);
  }

  #loadCarouselDoc(id) {
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const carousel = this.querySelector('copio-carousel');
    if (carousel) {
      const pages = JSON.parse(vals.pages || '[]');
      carousel.images = pages;
      this.showCarousel = true;
    }
  }

  handleRowView(e) {
    const id = e.detail?.id;
    if (id) this.#navigate(`/doc/${id}`);
  }

  handleRowDelete(e) {
    const id = e.detail?.id;
    this.store.delRow('docs', id);
    if (this.#router.getHashPath().startsWith(`/doc/${id}`)) {
      this.#navigate('/');
    }
  }

  async handleRowDownload(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    await exportDocumentAsPdf(vals.name, pages);
  }

  async handleRowDownloadImages(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    await exportDocumentAsImages(vals.name, pages);
  }

  handleRowDownloadMarkdown(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    exportDocumentAsMarkdown(vals.name, pages);
  }

  // Document OCR Handlers
  handleRowExtractOcr(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    const imagePages = pages.filter((p) => p.type !== 'markdown' && p.src);

    if (imagePages.length === 0) {
      alert('This document does not contain any image pages to perform text recognition on.');
      return;
    }

    this.ocrDocState = {
      isOpen: true,
      docId: id,
      docName: vals.name,
      lang: 'eng',
      step: 'processing',
      progress: 0,
      statusMessage: 'Starting OCR engine...',
      resultText: '',
      confidence: 0,
      copied: false,
    };

    this.startDocOcr(id, vals.name, pages, 'eng');
  }

  async startDocOcr(docId, docName, pages, lang = 'eng') {
    try {
      const result = await recognizeDocumentPages(pages, {
        lang,
        onPageProgress: ({ pageNumber, totalPages, overallProgress, message }) => {
          if (this.ocrDocState && this.ocrDocState.isOpen) {
            this.ocrDocState = {
              ...this.ocrDocState,
              progress: Math.round((overallProgress || 0) * 100),
              statusMessage: message,
            };
          }
        },
      });

      if (this.ocrDocState && this.ocrDocState.isOpen) {
        this.ocrDocState = {
          ...this.ocrDocState,
          step: 'done',
          resultText: result.combinedText || '',
          confidence: result.averageConfidence || 0,
        };
      }
    } catch (err) {
      console.error('Document OCR Error:', err);
      if (this.ocrDocState && this.ocrDocState.isOpen) {
        this.ocrDocState = {
          ...this.ocrDocState,
          step: 'error',
          statusMessage: err.message || 'Text recognition failed',
        };
      }
    }
  }

  handleDocOcrLangChange(e) {
    const newLang = e.target.value;
    if (!this.ocrDocState) return;

    const docId = this.ocrDocState.docId;
    const vals = this.store.getRow('docs', docId);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');

    this.ocrDocState = {
      ...this.ocrDocState,
      lang: newLang,
      step: 'processing',
      progress: 0,
      statusMessage: 'Starting OCR engine with new language...',
    };

    this.startDocOcr(docId, vals.name, pages, newLang);
  }

  async copyDocOcrText() {
    if (!this.ocrDocState?.resultText) return;
    try {
      await navigator.clipboard.writeText(this.ocrDocState.resultText);
      this.ocrDocState = { ...this.ocrDocState, copied: true };
      setTimeout(() => {
        if (this.ocrDocState) {
          this.ocrDocState = { ...this.ocrDocState, copied: false };
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }

  downloadDocOcrMarkdown() {
    if (!this.ocrDocState?.resultText) return;
    const safeName = (this.ocrDocState.docName || 'document').replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([this.ocrDocState.resultText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-ocr.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadDocOcrText() {
    if (!this.ocrDocState?.resultText) return;
    const safeName = (this.ocrDocState.docName || 'document').replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([this.ocrDocState.resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-ocr.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  saveDocOcrAsNote() {
    if (!this.ocrDocState?.resultText || !this.ocrDocState?.docId) return;
    const docId = this.ocrDocState.docId;
    const vals = this.store.getRow('docs', docId);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    pages.push({
      id: randomId(),
      type: 'markdown',
      name: 'OCR Full Transcript',
      content: this.ocrDocState.resultText,
    });

    this.store.setRow('docs', docId, {
      ...vals,
      pages: JSON.stringify(pages),
    });

    alert('OCR Transcript saved as a Markdown Note in this document!');
    this.closeDocumentOcrDialog();
  }

  closeDocumentOcrDialog() {
    this.ocrDocState = null;
  }

  handleCarouselClose() {
    this.#navigate('/');
  }

  startSyncAsHost = () => {
    this.#navigate('/sync');
  };

  startSyncAsJoiner = (remotePeerId) => {
    this.#navigate(`/sync/${remotePeerId}`);
  };

  closeSyncDialog = () => {
    this.#syncManager.close();
    if (this.#router.getHashPath().startsWith('/sync')) {
      this.#navigate('/');
    }
  };

  renderSyncDialog() {
    if (!this.syncState) return '';
    const { step, qrSvg, added, message } = this.syncState;
    let body;
    if (step === 'init') {
      body = html`<sl-spinner></sl-spinner> Setting up…`;
    } else if (step === 'waiting') {
      body = html`<div .innerHTML=${qrSvg}></div>
        <p>Waiting for other device…</p>`;
    } else if (step === 'connecting') {
      body = html`<sl-spinner></sl-spinner> Connecting…`;
    } else if (step === 'syncing') {
      body = html`<sl-spinner></sl-spinner> Syncing…`;
    } else if (step === 'done') {
      body = html`<p>
        Sync complete — ${added} doc${added !== 1 ? 's' : ''} added.
      </p>`;
    } else if (step === 'error') {
      body = html`<p style="color:var(--sl-color-danger-600)">
        Error: ${message}
      </p>`;
    }
    return html`
      <sl-dialog
        label="Link Device"
        open
        @sl-after-hide=${this.closeSyncDialog}
      >
        <div style="text-align:center;padding:1rem">${body}</div>
        <sl-button slot="footer" @click=${this.closeSyncDialog}
          >Close</sl-button
        >
      </sl-dialog>
    `;
  }

  renderDocumentOcrDialog() {
    if (!this.ocrDocState || !this.ocrDocState.isOpen) return '';

    return html`
      <sl-dialog
        label="Extract All Text (OCR) — ${this.ocrDocState.docName}"
        open
        style="--width: 85vw"
        @sl-after-hide=${this.closeDocumentOcrDialog}
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 8px;">
          <sl-select
            size="small"
            value=${this.ocrDocState.lang}
            @sl-change=${this.handleDocOcrLangChange}
            style="min-width: 180px;"
          >
            ${SUPPORTED_LANGUAGES.map(
              (l) => html`<sl-option value=${l.code}>${l.flag} ${l.label}</sl-option>`,
            )}
          </sl-select>

          ${this.ocrDocState.step === 'done'
            ? html`
                <sl-badge
                  variant=${this.ocrDocState.confidence >= 75
                    ? 'success'
                    : this.ocrDocState.confidence >= 50
                      ? 'warning'
                      : 'danger'}
                >
                  ${this.ocrDocState.confidence}% Avg Confidence
                </sl-badge>
              `
            : ''}
        </div>

        ${this.ocrDocState.step === 'processing'
          ? html`
              <div style="padding: 2.5rem 1rem; text-align: center;">
                <div style="font-size: 1.1rem; color: #0284c7; font-weight: 600; margin-bottom: 1rem;">
                  ${this.ocrDocState.statusMessage}
                </div>
                <sl-progress-bar value=${this.ocrDocState.progress}></sl-progress-bar>
                <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.75rem;">
                  100% Client-Side WebAssembly OCR — zero cloud servers
                </div>
              </div>
            `
          : ''}

        ${this.ocrDocState.step === 'error'
          ? html`
              <div style="padding: 2rem; text-align: center; color: #ef4444;">
                <sl-icon name="x-circle-fill" style="font-size: 2rem;"></sl-icon>
                <p style="margin-top: 0.5rem;">${this.ocrDocState.statusMessage}</p>
              </div>
            `
          : ''}

        ${this.ocrDocState.step === 'done'
          ? html`
              <div>
                <sl-textarea
                  rows="14"
                  .value=${this.ocrDocState.resultText}
                  @input=${(e) => {
                    this.ocrDocState = { ...this.ocrDocState, resultText: e.target.value };
                  }}
                  placeholder="Extracted transcript..."
                ></sl-textarea>
              </div>
            `
          : ''}

        <sl-button slot="footer" variant="default" @click=${this.closeDocumentOcrDialog}>
          Close
        </sl-button>
        ${this.ocrDocState.step === 'done'
          ? html`
              <sl-button slot="footer" variant="default" @click=${this.copyDocOcrText}>
                <sl-icon slot="prefix" name=${this.ocrDocState.copied ? 'check' : 'clipboard'}></sl-icon>
                ${this.ocrDocState.copied ? 'Copied!' : 'Copy All'}
              </sl-button>
              <sl-button slot="footer" variant="default" @click=${this.downloadDocOcrMarkdown}>
                <sl-icon slot="prefix" name="download"></sl-icon>
                Download .md
              </sl-button>
              <sl-button slot="footer" variant="primary" @click=${this.saveDocOcrAsNote}>
                <sl-icon slot="prefix" name="file-earmark-plus"></sl-icon>
                Save as Note
              </sl-button>
            `
          : ''}
      </sl-dialog>
    `;
  }

  renderRows() {
    if (!this.docsData || Object.keys(this.docsData).length === 0) {
      return html`
        <style>
          .empty-state {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: calc(100vh - 64px);
            padding: 1.5rem;
            text-align: center;
            color: white;
            background: #151f2a;
            box-sizing: border-box;
          }
          .empty-state-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            max-width: 360px;
            width: 100%;
            padding: 2.5rem 1.5rem;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.04);
            border: 2px dashed rgba(255, 255, 255, 0.2);
            cursor: pointer;
            transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
            box-sizing: border-box;
          }
          .empty-state-card:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.45);
            background: rgba(255, 255, 255, 0.07);
          }
          .empty-state-icon {
            font-size: 4.5rem;
            color: var(--sl-color-primary-400, #38bdf8);
          }
          .empty-state-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
          }
          .empty-state-text {
            font-size: 0.95rem;
            color: #9ca3af;
            margin: 0;
            line-height: 1.4;
          }
        </style>
        <div class="empty-state">
          <div class="empty-state-card" @click=${this.handleAddNew}>
            <sl-icon class="empty-state-icon" name="plus-circle"></sl-icon>
            <h2 class="empty-state-title">No documents yet</h2>
            <p class="empty-state-text">
              Tap here or the button below to add your first image or document.
            </p>
            <sl-button variant="primary" size="medium" @click=${(e) => { e.stopPropagation(); this.handleAddNew(); }}>
              <sl-icon slot="prefix" name="plus-circle"></sl-icon>
              Add Document
            </sl-button>
          </div>
        </div>
      `;
    }

    return html`
      ${Object.entries(this.docsData).map(
        ([id, { name }]) => html`
          <copio-row
            id=${id}
            name=${name}
            @copio-row:edit=${this.handleRowEdit}
            @copio-row:view=${this.handleRowView}
            @copio-row:extract-ocr=${this.handleRowExtractOcr}
            @copio-row:delete=${this.handleRowDelete}
            @copio-row:download=${this.handleRowDownload}
            @copio-row:download-images=${this.handleRowDownloadImages}
            @copio-row:download-markdown=${this.handleRowDownloadMarkdown}
          ></copio-row>
        `,
      )}
    `;
  }

  render() {
    return html`
      <copio-loader
        style="display: ${this.hideLoaderTimer === null ? 'none' : 'block'}"
      ></copio-loader>

      <article
        class="copio-items"
        style="display: ${this.showCarousel ? 'none' : 'block'}"
      >
        <copio-header
          @copio-header:link-device=${this.startSyncAsHost}
        ></copio-header>

        <div id="copio-rows">${this.renderRows()}</div>

        <sl-dialog
          label="Add / Edit"
          class="dialog-add-edit"
          style="--width: 90vw"
          @sl-hide=${this.handleAddEditHide}
          @keydown=${this.#handleDialogKeydown}
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
              @click=${this.handleAddEditSave}
              >Save</sl-button
            >
          </div>
        </sl-dialog>

        <div class="mr2 mb2 fixed bottom-0 right-0 z4">
          <sl-icon-button
            class="dialog-add-edit-btn"
            name="plus-circle"
            label="Add New"
            style="font-size: 2.5rem"
            @click=${this.handleAddNew}
          ></sl-icon-button>
        </div>
      </article>

      <copio-carousel
        style="display: ${this.showCarousel ? 'block' : 'none'}"
        @copio-carousel:close=${this.handleCarouselClose}
      ></copio-carousel>

      ${this.renderSyncDialog()}
      ${this.renderDocumentOcrDialog()}
    `;
  }
}

customElements.define('copio-app', CopioApp);
