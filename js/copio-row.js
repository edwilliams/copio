import { LitElement, html, css } from './lit-core.min.js';

class CopioRow extends LitElement {
  static properties = {
    name: { type: String },
  };

  static styles = css`
    .wrapper {
      margin-left: auto;
      margin-right: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 768px;
      padding: 8px;
      border-bottom: 1px solid #333;
      cursor: pointer;
    }
    .inner {
      display: flex;
      align-items: center;
    }
    .titles {
      display: flex;
      flex-direction: column;
      margin-left: 8px;
      padding: 8px;
    }
    button {
      appearance: none;
      border: none;
      color: black;
      padding: 3px 4px 3px 7px;
      background: white;
      cursor: pointer;
    }
  `;

  #handleWrapperClick(e) {
    if (e.target.closest('sl-dropdown')) return;
    this.handleView();
  }

  #handleMenuSelect(e) {
    const selected = e.detail.item.value;
    if (selected === 'delete') this.handleDelete();
    if (selected === 'edit') this.handleEdit();
    if (selected === 'download') this.handleDownload();
  }

  handleView() {
    this.dispatchEvent(
      new CustomEvent('copio-row:view', {
        bubbles: true,
        composed: true,
        detail: { id: this.getAttribute('id') },
      }),
    );
  }

  handleDelete() {
    this.dispatchEvent(
      new CustomEvent('copio-row:delete', {
        bubbles: true,
        composed: true,
        detail: { id: this.getAttribute('id') },
      }),
    );
  }

  handleEdit() {
    this.dispatchEvent(
      new CustomEvent('copio-row:edit', {
        bubbles: true,
        composed: true,
        detail: { id: this.getAttribute('id') },
      }),
    );
  }

  handleDownload() {
    this.dispatchEvent(
      new CustomEvent('copio-row:download', {
        bubbles: true,
        composed: true,
        detail: { id: this.getAttribute('id') },
      }),
    );
  }

  render() {
    return html`
      <div class="wrapper" @click=${this.#handleWrapperClick}>
        <div class="inner">
          <sl-avatar label="Document icon">
            <sl-icon slot="icon" name="file-earmark-text"></sl-icon>
          </sl-avatar>

          <div class="titles">
            <div>${this.name}</div>
          </div>
        </div>

        <sl-dropdown>
          <sl-button slot="trigger" variant="default" size="small" circle>
            <sl-icon name="three-dots-vertical"></sl-icon>
          </sl-button>
          <sl-menu @sl-select=${this.#handleMenuSelect}>
            <sl-menu-item value="edit">Edit</sl-menu-item>
            <sl-menu-item value="delete">Delete</sl-menu-item>
            <sl-menu-item value="download">Download as PDF</sl-menu-item>
          </sl-menu>
        </sl-dropdown>
      </div>
    `;
  }
}

customElements.define('copio-row', CopioRow);
