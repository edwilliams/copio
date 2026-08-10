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

  #handleDialogKeydown = (e) => {
    if (e.key === 'Enter') {
      if (e.target?.tagName === 'SL-BUTTON' || e.target?.tagName === 'BUTTON') return;
      e.preventDefault();
      this.handleAddEditSave();
    }
  };

  handleAddNew() {
    const dialog = this.querySelector('.dialog-add-edit');
    dialog.show();
    setTimeout(() => {
      this.querySelector('.dialog-add-edit-input-name')?.focus();
    }, 100);
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
    setTimeout(() => {
      inputName.focus();
    }, 100);

    await customElements.whenDefined('copio-images');
    const pages = JSON.parse(vals.pages || '[]');
    copioImages.images = pages.map(({ id, src, exif, type, name, content }) => ({ id, src, exif, type, name, content }));
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

  async renderMarkdownToImageDataUrl(page) {
    const rawContent = page.content || '';
    let htmlContent = window.marked && window.marked.parse ? window.marked.parse(rawContent) : rawContent;
    const width = 1240;
    const height = 1754;

    // Convert HTML to valid XHTML for SVG XML parser
    let cleanHtmlContent = htmlContent
      .replace(/&nbsp;/g, '&#160;')
      .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
      .replace(/<hr(\s+[^>]*?>|>)/gi, (m) => (m.endsWith('/>') ? m : m.slice(0, -1) + '/>'))
      .replace(/<br(\s+[^>]*?>|>)/gi, (m) => (m.endsWith('/>') ? m : m.slice(0, -1) + '/>'))
      .replace(/<input(\s+[^>]*?>|>)/gi, (m) => (m.endsWith('/>') ? m : m.slice(0, -1) + '/>'));

    // Handle <img> tags for SVG foreignObject
    cleanHtmlContent = cleanHtmlContent.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (match, src) => {
      if (src.startsWith('data:')) {
        return `<img src="${src}" style="max-width:100%;height:auto;border-radius:6px;" />`;
      }
      return '<div style="padding:16px;background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:8px;color:#475569;font-weight:600;font-size:1em;text-align:center;margin:1em 0;">📷 Image Attachment</div>';
    });

    try {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
              <style>
                .pdf-md-container {
                  width: ${width}px;
                  min-height: ${height}px;
                  padding: 50px;
                  box-sizing: border-box;
                  background: #ffffff;
                  color: #0f172a;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  line-height: 1.6;
                }
                .pdf-md-container h1, .pdf-md-container h2, .pdf-md-container h3, .pdf-md-container h4 {
                  color: #0f172a;
                  margin-top: 1.3em;
                  margin-bottom: 0.4em;
                  font-weight: 700;
                  line-height: 1.25;
                  border-bottom: 1px solid #e2e8f0;
                  padding-bottom: 0.3em;
                }
                .pdf-md-container h1 { font-size: 2.2em; }
                .pdf-md-container h2 { font-size: 1.6em; }
                .pdf-md-container h3 { font-size: 1.3em; }
                .pdf-md-container p { margin-top: 0; margin-bottom: 1em; font-size: 1.1em; }
                .pdf-md-container ul, .pdf-md-container ol { padding-left: 2em; margin-bottom: 1em; font-size: 1.1em; }
                .pdf-md-container li { margin-bottom: 0.3em; }
                .pdf-md-container code {
                  background: #f1f5f9;
                  color: #0f172a;
                  padding: 0.2em 0.4em;
                  border-radius: 4px;
                  font-family: monospace;
                  font-size: 0.9em;
                }
                .pdf-md-container pre {
                  background: #0f172a;
                  color: #f8fafc;
                  padding: 1em;
                  border-radius: 8px;
                  overflow-x: auto;
                }
                .pdf-md-container pre code { background: none; color: inherit; padding: 0; }
                .pdf-md-container blockquote {
                  border-left: 4px solid #0284c7;
                  margin: 1em 0;
                  padding-left: 1em;
                  color: #475569;
                  font-style: italic;
                }
                .pdf-md-container table {
                  border-collapse: collapse;
                  width: 100%;
                  margin-bottom: 1em;
                }
                .pdf-md-container th, .pdf-md-container td {
                  border: 1px solid #cbd5e1;
                  padding: 8px 12px;
                  text-align: left;
                }
                .pdf-md-container th {
                  background: #f1f5f9;
                  font-weight: 600;
                }
                .pdf-md-container img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 6px;
                }
              </style>
              <div class="pdf-md-container">
                ${cleanHtmlContent}
              </div>
            </div>
          </foreignObject>
        </svg>
      `;

      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('SVG foreignObject render failed, using Canvas fallback:', err);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(page.name || 'Markdown Note', 60, 80);
      ctx.font = '22px sans-serif';
      const lines = rawContent.split('\n');
      let y = 140;
      for (const line of lines) {
        if (y > canvas.height - 80) break;
        ctx.fillText(line.slice(0, 75), 60, y);
        y += 34;
      }
      return canvas.toDataURL('image/jpeg', 0.85);
    }
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
        let imgSrc = page.src;
        if (page.type === 'markdown') {
          imgSrc = await this.renderMarkdownToImageDataUrl(page);
        }

        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = (err) => {
            console.warn('Page image failed to load for PDF:', err);
            resolve();
          };
          img.src = imgSrc;
        });

        if (!img.width || !img.height) continue;

        doc.addPage({ size: 'A4' });

        const scaleX = A4_WIDTH / img.width;
        const scaleY = A4_HEIGHT / img.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        const x = (A4_WIDTH - scaledWidth) / 2;
        const y = (A4_HEIGHT - scaledHeight) / 2;

        doc.image(imgSrc, x, y, {
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

  async handleRowDownloadImages(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    if (pages.length === 0) {
      alert('No images to export');
      return;
    }

    try {
      const docName = (vals.name || 'document').trim();
      const sanitize = (str) => str.replace(/[/\\?%*:|"<>]/g, '_');
      const safeName = sanitize(docName) || 'document';

      if (pages.length === 1) {
        const page = pages[0];
        let ext = 'jpg';
        if (page.src.startsWith('data:')) {
          const match = page.src.match(/^data:(image\/[a-zA-Z+]+);base64,/);
          if (match && match[1].includes('png')) ext = 'png';
        }

        let downloadUrl = page.src;
        let shouldRevoke = false;

        if (!page.src.startsWith('data:') && !page.src.startsWith('blob:')) {
          const response = await fetch(page.src);
          const blob = await response.blob();
          downloadUrl = URL.createObjectURL(blob);
          shouldRevoke = true;
        }

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${safeName}.${ext}`;
        a.click();
        if (shouldRevoke) URL.revokeObjectURL(downloadUrl);
      } else {
        const zip = new JSZip();
        const padLen = Math.max(2, String(pages.length).length);

        for (let index = 0; index < pages.length; index++) {
          const page = pages[index];
          let ext = 'jpg';
          let base64Data = '';

          if (page.type === 'markdown') {
            const dataUrl = await this.renderMarkdownToImageDataUrl(page);
            ext = 'jpg';
            base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
          } else if (page.src && page.src.startsWith('data:')) {
            const match = page.src.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
            if (match) {
              if (match[1].includes('png')) ext = 'png';
              base64Data = match[2];
            } else {
              base64Data = page.src.replace(/^data:[^;]+;base64,/, '');
            }
          } else {
            const response = await fetch(page.src);
            const blob = await response.blob();
            const arrayBuf = await blob.arrayBuffer();
            const pageNum = String(index + 1).padStart(padLen, '0');
            const fileName = `${safeName}-${pageNum}.${ext}`;
            zip.file(fileName, arrayBuf);
            continue;
          }

          const pageNum = String(index + 1).padStart(padLen, '0');
          const fileName = `${safeName}-${pageNum}.${ext}`;
          zip.file(fileName, base64Data, { base64: true });
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading images:', error);
      alert('Failed to download images');
    }
  }

  handleRowDownloadMarkdown(e) {
    const id = e.detail?.id;
    const vals = this.store.getRow('docs', id);
    if (!vals) return;

    const pages = JSON.parse(vals.pages || '[]');
    const mdPages = pages.filter((p) => p.type === 'markdown');

    if (mdPages.length === 0) {
      alert('No markdown text in this document');
      return;
    }

    const docName = (vals.name || 'document').trim().replace(/[/\\?%*:|"<>]/g, '_');

    if (mdPages.length === 1) {
      const blob = new Blob([mdPages[0].content || ''], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docName}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const combined = mdPages.map((p, i) => `# Page ${i + 1}: ${p.name || ''}\n\n${p.content || ''}`).join('\n\n---\n\n');
      const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docName}.md`;
      a.click();
      URL.revokeObjectURL(url);
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
    `;
  }
}

customElements.define('copio-app', CopioApp);
