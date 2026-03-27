import { LitElement, html } from './lit-core.min.js';
import { randomId } from './utils.js';
import { createStore } from './tinybase.6.5.2.js';
import { createIndexedDbPersister } from './tinybase-persister-indexed-db.js';

class CopioApp extends LitElement {
  #peer = null;

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

    // Setup TinyBase store
    this.store = createStore();
    this.store.setTable('docs', {});

    this.persister = createIndexedDbPersister(this.store, 'copio-db');
    this.persister.startAutoLoad();
    this.persister.startAutoSave();

    // Bridge TinyBase reactivity to Lit - critical integration pattern
    this.store.addTableListener('docs', () => {
      this.docsData = this.store.getTable('docs');
      // Lit detects property change and automatically queues re-render
    });

    // No manual .bind() needed - Lit templates auto-bind arrow functions
  }

  // Runs after first render - replaces connectedCallback
  firstUpdated() {
    this.hideLoader();

    // Load persisted data - triggers TinyBase listener → updates docsData → Lit re-renders
    this.persister.load();

    const peerId = new URLSearchParams(window.location.search).get('peer');
    if (peerId) {
      history.replaceState({}, '', window.location.pathname);
      this.startSyncAsJoiner(peerId);
    }
  }

  // Cleanup
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.hideLoaderTimer);
    // Event listeners in template auto-cleanup, no manual removal needed
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

  handleAddNew() {
    this.querySelector('.dialog-add-edit').show();
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

    const pages = copioImages.images.map(({ id, src, exif }) => ({
      id,
      src,
      exif,
    }));

    const id = inputId?.value || randomId();

    this.store.setRow('docs', id, {
      name: inputName.value,
      pages: JSON.stringify(pages),
    });

    this.querySelector('.dialog-add-edit').hide();
  }

  handleAddEditHide(event) {
    // Clear form when dialog closes
    if (event.target !== event.currentTarget) return;

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    inputId.value = '';
    inputName.value = '';
    copioImages.images = [];
  }

  async handleRowEdit(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const dialog = this.querySelector('.dialog-add-edit');
    dialog.show();

    const inputId = this.querySelector('.dialog-add-edit-input-id');
    const inputName = this.querySelector('.dialog-add-edit-input-name');
    const copioImages = this.querySelector('copio-images');

    inputId.value = id;
    inputName.value = vals.name;

    await customElements.whenDefined('copio-images');
    const pages = JSON.parse(vals.pages || '[]');
    copioImages.images = pages.map(({ id, src, exif }) => ({ id, src, exif }));
  }

  handleRowView(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const carousel = this.querySelector('copio-carousel');
    const pages = JSON.parse(vals.pages || '[]');
    carousel.images = pages;

    this.showCarousel = true; // Reactive property triggers re-render
  }

  handleRowDelete(e) {
    const id = e.detail?.id;
    this.store.delRow('docs', id);
    // TinyBase listener updates docsData → Lit re-renders automatically
  }

  async handleRowDownload(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    if (pages.length === 0) {
      alert('No images to export');
      return;
    }

    try {
      // A4 dimensions in points (72 points per inch)
      const A4_WIDTH = 595.28;
      const A4_HEIGHT = 841.89;

      const doc = new PDFDocument({ autoFirstPage: false });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      doc.on('end', () => {
        const blob = new Blob(chunks, { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${vals.name || 'document'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      });

      for (const page of pages) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = page.src;
        });

        doc.addPage({ size: 'A4' });

        const scaleX = A4_WIDTH / img.width;
        const scaleY = A4_HEIGHT / img.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        const x = (A4_WIDTH - scaledWidth) / 2;
        const y = (A4_HEIGHT - scaledHeight) / 2;

        doc.image(page.src, x, y, {
          width: scaledWidth,
          height: scaledHeight,
        });
      }

      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  }

  handleCarouselClose() {
    this.showCarousel = false; // Triggers re-render
  }

  startSyncAsHost = () => {
    if (!navigator.onLine) {
      const alert = Object.assign(document.createElement('sl-alert'), {
        variant: 'warning',
        closable: true,
        duration: 4000,
        innerHTML:
          '<sl-icon name="wifi-off" slot="icon"></sl-icon> An internet connection is needed to link devices.',
      });
      document.body.appendChild(alert);
      alert.toast();
      return;
    }
    this.syncState = { mode: 'host', step: 'init' };
    try {
      this.#peer = new Peer();
      this.#peer.on('error', (err) => {
        this.syncState = {
          ...this.syncState,
          step: 'error',
          message: err.message,
        };
      });
      this.#peer.on('open', (id) => {
        const url = `${location.origin}${location.pathname}?peer=${id}`;
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        this.syncState = {
          mode: 'host',
          step: 'waiting',
          qrSvg: qr.createSvgTag(4, 8),
        };
      });
      this.#peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.syncState = { ...this.syncState, step: 'syncing' };
          this.#doSync(conn);
        });
      });
    } catch (err) {
      this.syncState = { mode: 'host', step: 'error', message: err.message };
    }
  };

  startSyncAsJoiner = (remotePeerId) => {
    this.syncState = { mode: 'joiner', step: 'connecting' };
    try {
      this.#peer = new Peer();
      this.#peer.on('error', (err) => {
        this.syncState = {
          ...this.syncState,
          step: 'error',
          message: err.message,
        };
      });
      this.#peer.on('open', () => {
        const conn = this.#peer.connect(remotePeerId);
        conn.on('error', (err) => {
          this.syncState = {
            ...this.syncState,
            step: 'error',
            message: err.message,
          };
        });
        conn.on('open', () => {
          this.syncState = { ...this.syncState, step: 'syncing' };
          this.#doSync(conn);
        });
      });
    } catch (err) {
      this.syncState = { mode: 'joiner', step: 'error', message: err.message };
    }
  };

  #doSync(conn) {
    conn.send(JSON.stringify(this.store.getTable('docs')));
    conn.on('data', (raw) => {
      const rows = JSON.parse(raw);
      let added = 0;
      for (const [id, row] of Object.entries(rows)) {
        if (!this.store.hasRow('docs', id)) added++;
        this.store.setRow('docs', id, row);
      }
      this.syncState = { ...this.syncState, step: 'done', added };
    });
  }

  closeSyncDialog = () => {
    this.#peer?.destroy();
    this.#peer = null;
    this.syncState = null;
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

  renderRows() {
    // this.docsData is reactive - automatically updated by TinyBase listener
    if (!this.docsData || Object.keys(this.docsData).length === 0) {
      return html`
        <style>
          .wrapper {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: calc(100vh - 64px);
            padding: 8px;
            text-align: center;
            color: white;
            background: #151f2a;
            border-top: 1px solid #fff;
          }
        </style>
        <div class="wrapper">
          <span>
            Tap the <sl-icon name="plus-circle"></sl-icon> icon below to add an
            image / document.
          </span>
        </div>
      `;
    }

    // Lit's .map() pattern for lists
    return html`
      ${Object.entries(this.docsData).map(
        ([id, { name }]) => html`
          <copio-row
            id=${id}
            name=${name}
            @copio-row:edit=${this.handleRowEdit}
            @copio-row:view=${this.handleRowView}
            @copio-row:delete=${this.handleRowDelete}
            @copio-row:download=${this.handleRowDownload}
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
    `;
  }
}

customElements.define('copio-app', CopioApp);
