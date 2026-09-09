import { LitElement, html } from '../../lib/lit-core.min.js';

class CopioSyncDialog extends LitElement {
  static properties = {
    syncState: { type: Object }
  };

  createRenderRoot() {
    return this;
  }

  closeSyncDialog = () => {
    this.dispatchEvent(new CustomEvent('copio-sync-dialog:close', { bubbles: true }));
  };

  render() {
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
}

customElements.define('copio-sync-dialog', CopioSyncDialog);
