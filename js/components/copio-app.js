// @ts-nocheck
import { LitElement, html } from '../lib/lit-core.min.js';
import { router } from '../core/router.js';
import { randomId } from '../utils/utils.js';
import { docRepository } from '../services/doc-repository.js';
import { exportDocumentAsPdf, exportDocumentAsImages, exportDocumentAsMarkdown } from '../services/export-utils.js';
import { SyncManager } from '../services/sync-service.js';
import { notify } from '../services/notify.js';
import { terminateOcrWorker } from '../services/ocr-service.js';
import '../../sdk/index.js';

export class CopioApp extends LitElement {
  #syncManager = null;
  #unsubscribeRouter = null;
  #repoUnsubscribe = null;
  #scannerDocId = null;

  static properties = {
    docsData: { type: Object, state: true },
    showCarousel: { type: Boolean, state: true },
    syncState: { type: Object, state: true },
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
    this.hideLoaderTimer = null;

    // Document repository
    this.docRepo = docRepository;

    // Bridge repository reactivity to Lit
    this.#repoUnsubscribe = this.docRepo.subscribe(() => {
      this.#refreshDocs();
      const currentPath = router.getHashPath();
      if (currentPath.startsWith('/doc/')) {
        router.handleRoute();
      }
    });

    // Initialize PeerJS sync service
    this.#syncManager = new SyncManager(this.docRepo, (state) => {
      this.syncState = state;
    });
  }

  get store() {
    return this.docRepo.store;
  }

  get persister() {
    return this.docRepo.adapter?.persister;
  }

  #refreshDocs() {
    if (typeof this.docRepo.listDocsSync === 'function') {
      const docs = this.docRepo.listDocsSync();
      this.docsData = Object.fromEntries(docs.map((d) => [d.id, d]));
    } else {
      this.docRepo.listDocs().then((docs) => {
        this.docsData = Object.fromEntries(docs.map((d) => [d.id, d]));
      });
    }
  }

  // Runs after first render - replaces connectedCallback
  async firstUpdated() {
    this.hideLoader();

    // Scope notifications to this container if hosted in a constrained container
    if (this.closest('.copio-scanner-host') || (this.parentElement && this.parentElement !== document.body)) {
      notify.setContainer(this);
    }

    // Load persisted data via repository
    await this.docRepo.init();
    await this.#refreshDocs();

    this.#unsubscribeRouter = router.onRouteChange((route) => {
      this.#handleRouteChange(route);
    });

    const peerId = new URLSearchParams(window.location.search).get('peer');
    if (peerId) {
      history.replaceState({}, '', window.location.pathname);
      router.navigate(`/sync/${peerId}`);
    } else {
      router.handleRoute();
    }
  }

  // Cleanup
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.hideLoaderTimer);
    this.#unsubscribeRouter?.();
    if (this.#repoUnsubscribe) {
      this.#repoUnsubscribe();
      this.#repoUnsubscribe = null;
    }
    this.#syncManager?.close();
    terminateOcrWorker();
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

  async #handleRouteChange({ name, params }) {
    if (name !== 'doc-view') {
      this.showCarousel = false;
    }

    switch (name) {
      case 'home':
        break;
      case 'add':
        await this.#openAddDialog();
        break;
      case 'scan':
        await this.openScanner();
        break;
      case 'doc-view':
        this.#loadCarouselDoc(params.id);
        break;
      case 'doc-edit':
        await this.#loadEditDoc(params.id);
        break;
      case 'sync-host':
        await this.#startSyncHost();
        break;
      case 'sync-join':
        await this.#startSyncJoiner(params.peer);
        break;
    }
  }

  async openScanner(opts = {}) {
    await this.updateComplete;
    this.#requestPersistentStorage();
    this.#scannerDocId = opts.docId || null;
    const dialog = this.querySelector('.copio-scanner-modal');
    const scanner = this.querySelector('#app-embedded-scanner');
    if (scanner) {
      if (opts.mode) scanner.mode = opts.mode;
      if (opts.aspect) scanner.aspect = opts.aspect;
      if (opts.docId) {
        scanner.setAttribute('doc-id', opts.docId);
      } else {
        scanner.removeAttribute('doc-id');
        await scanner.clear?.();
      }
    }
    if (dialog) {
      await dialog.show();
    }
  }

  closeScanner() {
    const dialog = this.querySelector('.copio-scanner-modal');
    if (dialog && dialog.open) {
      dialog.hide();
    }
    this.#scannerDocId = null;
  }

  handleScanComplete = (e) => {
    const detail = e.detail || {};
    const pages = detail.pages || (detail.page ? [detail.page] : []);
    if (!pages || pages.length === 0) return;

    const id = this.#scannerDocId || randomId();
    const existing = typeof this.docRepo.getDocSync === 'function' ? this.docRepo.getDocSync(id) : null;
    const name = existing?.name || `Scan ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    this.docRepo.saveDoc(id, { name, pages });
    notify.success(`Saved "${name}" (${pages.length} ${pages.length === 1 ? 'page' : 'pages'})`);
    this.closeScanner();
    if (router.getHashPath() !== '/') {
      router.navigate('/');
    }
  };

  async #openAddDialog() {
    const dialog = this.querySelector('copio-add-edit-dialog');
    if (dialog) await dialog.open();
  }

  handleAddNew() {
    this.#requestPersistentStorage();
    router.navigate('/add');
  }

  async #requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(`[Storage] Persist granted: ${isPersisted}`);
      } catch (err) {
        console.warn(`[Storage] Persist request failed:`, err);
      }
    }
  }

  handleAddEditSave(e) {
    const { id, name, pages } = e.detail;
    this.docRepo.saveDoc(id, { name, pages });
    notify.success(`Saved "${name || 'document'}"`);
    router.navigate('/');
  }

  handleAddEditHide() {
    if (router.getHashPath() !== '/') {
      router.navigate('/');
    }
  }

  async #loadEditDoc(id) {
    const doc = this.docRepo.getDocSync(id) || await this.docRepo.getDoc(id);
    if (!doc) return;
    const dialog = this.querySelector('copio-add-edit-dialog');
    if (dialog) await dialog.openEdit(id, doc.name, doc.pages);
  }

  async #startSyncHost() {
    await this.updateComplete;
    this.#syncManager.startHost();
  }

  async #startSyncJoiner(peer) {
    await this.updateComplete;
    this.#syncManager.startJoiner(peer);
  }

  handleRowEdit(e) {
    const id = e.detail?.id;
    if (id) router.navigate(`/doc/${id}/edit`);
  }

  #loadCarouselDoc(id) {
    const doc = this.docRepo.getDocSync(id);
    if (!doc) return;

    const carousel = this.querySelector('copio-carousel');
    if (carousel) {
      carousel.docId = id;
      carousel.docName = doc.name || 'document';
      carousel.images = doc.pages || [];
      this.showCarousel = true;
    }
  }

  handleRowView(e) {
    const id = e.detail?.id;
    if (id) router.navigate(`/doc/${id}`);
  }

  async handleRowRename(e) {
    const { id, name } = e.detail || {};
    if (!id || !name) return;
    try {
      await this.docRepo.renameDoc(id, name);
      notify.success(`Renamed document to "${name}"`);
    } catch (err) {
      console.error('Failed to rename document:', err);
      notify.error('Failed to rename document');
    }
  }

  async handleRowDelete(e) {
    const id = e.detail?.id;
    if (!id) return;
    const doc = this.docRepo.getDocSync(id);
    const docName = doc?.name || 'document';
    await this.docRepo.deleteDoc(id);
    notify.undo(
      `Deleted "${docName}"`,
      async () => {
        await this.docRepo.undoDeleteDoc(id);
        notify.success(`Restored "${docName}"`);
      },
      { duration: 5000 },
    );
    if (router.getHashPath().startsWith(`/doc/${id}`)) {
      router.navigate('/');
    }
  }

  async handleRowDownload(e) {
    const id = e.detail?.id;
    if (!id) return;
    const doc = await this.docRepo.getDoc(id);
    if (!doc) return;
    await exportDocumentAsPdf(doc.name, doc.pages);
  }

  async handleRowDownloadImages(e) {
    const id = e.detail?.id;
    if (!id) return;
    const doc = await this.docRepo.getDoc(id);
    if (!doc) return;
    await exportDocumentAsImages(doc.name, doc.pages);
  }

  async handleRowDownloadMarkdown(e) {
    const id = e.detail?.id;
    if (!id) return;
    const doc = await this.docRepo.getDoc(id);
    if (!doc) return;
    exportDocumentAsMarkdown(doc.name, doc.pages);
  }

  async handleCarouselDownloadPdf(e) {
    const { docName, pages } = e.detail || {};
    await exportDocumentAsPdf(docName, pages);
  }

  async handleCarouselDownloadImages(e) {
    const { docName, pages } = e.detail || {};
    await exportDocumentAsImages(docName, pages);
  }

  async handleCarouselDownloadMarkdown(e) {
    const { docName, pages } = e.detail || {};
    exportDocumentAsMarkdown(docName, pages);
  }

  // Document OCR Handlers
  async handleRowExtractOcr(e) {
    const id = e.detail?.id;
    if (!id) return;
    const doc = await this.docRepo.getDoc(id);
    if (!doc) return;

    const ocrDialog = this.querySelector('copio-doc-ocr-dialog');
    if (ocrDialog) {
      ocrDialog.open(id, doc.name, doc.pages);
    }
  }

  /**
   * Handle copio:ocr-page — fired by copio-images (page grid) or copio-carousel.
   * Determines the current document from the active route and opens the shared
   * OCR dialog in single-page mode via openPage().
   */
  async handleOcrPage(e) {
    const { page, pageIndex } = e.detail || {};
    if (!page) return;

    // Find the active doc from the current route
    const currentPath = router.getHashPath();
    let docId = null;

    // Carousel view route: /doc/:id
    const viewMatch = currentPath.match(/^\/doc\/([^/]+)$/);
    // Edit route: /doc/:id/edit
    const editMatch = currentPath.match(/^\/doc\/([^/]+)\/edit$/);

    if (viewMatch) docId = viewMatch[1];
    else if (editMatch) docId = editMatch[1];

    if (!docId) return;

    const doc = await this.docRepo.getDoc(docId);
    if (!doc) return;

    const ocrDialog = this.querySelector('copio-doc-ocr-dialog');
    if (ocrDialog) {
      ocrDialog.openPage(docId, doc.name, page, pageIndex);
    }
  }

  async handleOcrSaveNote(e) {
    const { docId, content, pageIndex } = e.detail || {};
    if (!docId || !content) return;

    const doc = await this.docRepo.getDoc(docId);
    if (!doc) return;

    const noteName =
      pageIndex !== null && pageIndex !== undefined
        ? `OCR — Page ${pageIndex + 1}`
        : 'OCR Full Transcript';

    const newNote = {
      id: randomId(),
      type: 'markdown',
      name: noteName,
      content,
    };

    const pages = [...(doc.pages || [])];
    if (pageIndex !== null && pageIndex !== undefined) {
      // Insert right after the source image page
      pages.splice(pageIndex + 1, 0, newNote);
    } else {
      // Full-document mode: append at the end
      pages.push(newNote);
    }

    await this.docRepo.saveDoc(docId, {
      ...doc,
      pages,
    });
  }

  handleCarouselClose() {
    router.navigate('/');
  }

  startSyncAsHost = () => {
    router.navigate('/sync');
  };

  startSyncAsJoiner = (remotePeerId) => {
    router.navigate(`/sync/${remotePeerId}`);
  };

  closeSyncDialog = () => {
    this.#syncManager.close();
    if (router.getHashPath().startsWith('/sync')) {
      router.navigate('/');
    }
  };

  handleClearCache = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      } catch (err) {
        console.warn('Error unregistering service workers:', err);
      }
    }

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (err) {
        console.warn('Error deleting caches:', err);
      }
    }

    window.location.reload();
  };

  


  renderRows() {
    if (!this.docsData || Object.keys(this.docsData).length === 0) {
      return html`
        <style>
          .empty-state {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            min-height: 100%;
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
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 10px;">
              <sl-button variant="primary" size="medium" class="empty-state-scan-btn" @click=${(e) => { e.stopPropagation(); this.openScanner(); }}>
                <sl-icon slot="prefix" name="camera"></sl-icon>
                Scan Document
              </sl-button>
              <sl-button variant="default" size="medium" @click=${(e) => { e.stopPropagation(); this.handleAddNew(); }}>
                <sl-icon slot="prefix" name="plus-circle"></sl-icon>
                Add Document
              </sl-button>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      ${Object.entries(this.docsData).map(
        ([id, doc]) => html`
          <copio-row
            id=${id}
            name=${doc.name}
            .pages=${doc.pages || []}
            @doc:edit=${this.handleRowEdit}
            @doc:rename=${this.handleRowRename}
            @doc:view=${this.handleRowView}
            @doc:extract-ocr=${this.handleRowExtractOcr}
            @doc:delete=${this.handleRowDelete}
            @doc:download=${this.handleRowDownload}
            @doc:download-images=${this.handleRowDownloadImages}
            @doc:download-markdown=${this.handleRowDownloadMarkdown}
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
        style="display: ${this.showCarousel ? 'none' : 'flex'}"
      >
        <copio-header
          @header:link-device=${this.startSyncAsHost}
          @header:clear-cache=${this.handleClearCache}
        ></copio-header>

        <div id="copio-rows">${this.renderRows()}</div>

        <copio-add-edit-dialog
          @dialog:save=${this.handleAddEditSave}
          @dialog:close=${this.handleAddEditHide}
          @copio:ocr-page=${this.handleOcrPage}
        ></copio-add-edit-dialog>

        <sl-dialog
          label="Document Scanner"
          class="copio-scanner-modal"
          style="--width: min(96%, 680px); --sl-panel-background-color: #0b0f17;"
          @sl-after-hide=${() => {
            this.#scannerDocId = null;
            if (router.getHashPath() === '/scan') router.navigate('/');
          }}
        >
          <div class="copio-scanner-host" style="width: 100%; height: min(72cqh, 560px); min-height: 420px; display: flex;">
            <copio-scanner
              id="app-embedded-scanner"
              mode="batch"
              aspect="auto"
              theme="dark"
              ocr="true"
              pdf="true"
              @copio:scan-complete=${this.handleScanComplete}
            ></copio-scanner>
          </div>
        </sl-dialog>

        <div class="copio-fab-wrap" style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
          <sl-icon-button
            class="dialog-scan-btn"
            name="camera"
            label="Scan Document"
            style="font-size: 1.8rem; background: #38bdf8; color: #06131f; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.35); min-width: 44px; min-height: 44px;"
            @click=${() => this.openScanner()}
          ></sl-icon-button>
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
        @dialog:close=${this.handleCarouselClose}
        @copio:ocr-page=${this.handleOcrPage}
        @doc:download-pdf=${this.handleCarouselDownloadPdf}
        @doc:download-images=${this.handleCarouselDownloadImages}
        @doc:download-markdown=${this.handleCarouselDownloadMarkdown}
      ></copio-carousel>

      ${this.syncState ? html`<copio-sync-dialog
        .syncState=${this.syncState}
        @dialog:close=${this.closeSyncDialog}
      ></copio-sync-dialog>` : ''}
      <copio-doc-ocr-dialog
        @note:save=${this.handleOcrSaveNote}
      ></copio-doc-ocr-dialog>
    `;
  }
}

customElements.define('copio-app', CopioApp);
