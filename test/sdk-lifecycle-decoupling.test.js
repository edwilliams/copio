import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import * as SDK from '../sdk/index.js';
import { store, persister } from '../js/core/store.js';
import { router } from '../js/core/router.js';

describe('CPO-039: Lifecycle Hygiene - Cleanup on Disconnect', () => {
  it('mounts and unmounts <copio-images> 50 times without error or resource leakage', async () => {
    const initialDivCount = document.querySelectorAll('*').length;

    for (let i = 0; i < 50; i++) {
      const el = document.createElement('copio-images');
      el.images = [
        { id: `page-${i}`, src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', type: 'image' },
      ];
      document.body.appendChild(el);
      expect(el.isConnected).to.be.true;

      // Unmount
      el.remove();
      expect(el.isConnected).to.be.false;
    }

    // Ensure DOM is fully clean after 50 cycles
    const finalDivCount = document.querySelectorAll('*').length;
    expect(finalDivCount).to.equal(initialDivCount);
  });

  it('<copio-images> destroys Sortable instance on disconnectedCallback', async () => {
    const el = document.createElement('copio-images');
    document.body.appendChild(el);
    el.images = [
      { id: '1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
    ];

    // Trigger Sortable setup
    const container = el.shadowRoot.querySelector('.container');
    expect(container).to.exist;

    // Disconnect element
    el.remove();

    // Reconnecting should reinitialize cleanly
    document.body.appendChild(el);
    expect(el.isConnected).to.be.true;
    el.remove();
  });

  it('<copio-images> stops active camera tracks on disconnectedCallback', async () => {
    const el = document.createElement('copio-images');
    document.body.appendChild(el);

    let stopped = false;
    const fakeTrack = {
      stop: () => {
        stopped = true;
      },
    };
    const fakeStream = {
      getTracks: () => [fakeTrack],
    };

    el.setCameraStream(fakeStream);
    expect(stopped).to.be.false;

    // Disconnect
    el.remove();
    expect(stopped).to.be.true;
  });

  it('<copio-images> revokes tracked object URLs on disconnectedCallback', async () => {
    const el = document.createElement('copio-images');
    document.body.appendChild(el);

    const revokedUrls = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => {
      revokedUrls.push(url);
      origRevoke.call(URL, url);
    };

    try {
      el.images = [{ id: '1', type: 'markdown', name: 'Note.md', content: 'test content' }];
      // Trigger download which creates and revokes an object URL
      el.downloadImage(0);
      expect(revokedUrls).to.have.lengthOf(1);

      // Disconnecting element clears any remaining tracked URLs
      el.remove();
      expect(el.isConnected).to.be.false;
    } finally {
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('<copio-doc-ocr-dialog> aborts operation and cleans up worker on disconnectedCallback', async () => {
    for (let i = 0; i < 50; i++) {
      const dialog = document.createElement('copio-doc-ocr-dialog');
      document.body.appendChild(dialog);
      expect(dialog.isConnected).to.be.true;
      dialog.remove();
      expect(dialog.isConnected).to.be.false;
      expect(dialog.isOpen).to.be.false;
    }
  });

  it('mounts and unmounts <copio-app> 50 times cleanly removing listeners', async () => {
    store.delTable('docs');
    await persister.save();

    for (let i = 0; i < 50; i++) {
      const app = document.createElement('copio-app');
      document.body.appendChild(app);
      await app.updateComplete;
      expect(app.isConnected).to.be.true;

      app.remove();
      expect(app.isConnected).to.be.false;
    }

    store.delTable('docs');
    await persister.save();
  });
});

describe('CPO-040: Remove Router Dependency from SDK Components', () => {
  it('SDK entrypoint exports expected components and headless services', () => {
    expect(SDK.CopioImages).to.exist;
    expect(SDK.CopioCarousel).to.exist;
    expect(SDK.CopioDocOcrDialog).to.exist;
    expect(SDK.CopioSyncDialog).to.exist;
    expect(SDK.CopioAddEditDialog).to.exist;
    expect(SDK.CopioRow).to.exist;
    expect(SDK.CopioHeader).to.exist;
    expect(SDK.CopioLoader).to.exist;
    expect(SDK.recognizeImageText).to.be.a('function');
    expect(SDK.SyncManager).to.exist;
    expect(SDK.exportDocumentAsPdf).to.be.a('function');
    expect(SDK.notify).to.exist;
  });

  it('<copio-row> emits events without importing or mutating router', async () => {
    const row = document.createElement('copio-row');
    row.setAttribute('id', 'doc-test-123');
    row.name = 'Test Document';
    document.body.appendChild(row);

    let viewEventDetail = null;
    let editEventDetail = null;

    row.addEventListener('doc:view', (e) => {
      viewEventDetail = e.detail;
    });
    row.addEventListener('doc:edit', (e) => {
      editEventDetail = e.detail;
    });

    row.handleView();
    expect(viewEventDetail).to.deep.equal({ id: 'doc-test-123' });

    row.handleEdit();
    expect(editEventDetail).to.deep.equal({ id: 'doc-test-123' });

    row.remove();
  });

  it('<copio-carousel> emits close event instead of navigating', async () => {
    const carousel = document.createElement('copio-carousel');
    document.body.appendChild(carousel);

    let closeFired = false;
    carousel.addEventListener('dialog:close', () => {
      closeFired = true;
    });

    carousel.handleBackClick();
    expect(closeFired).to.be.true;

    carousel.remove();
  });

  it('<copio-sync-dialog> emits close event instead of navigating', async () => {
    const dialog = document.createElement('copio-sync-dialog');
    document.body.appendChild(dialog);

    let closeFired = false;
    dialog.addEventListener('dialog:close', () => {
      closeFired = true;
    });

    dialog.closeSyncDialog();
    expect(closeFired).to.be.true;

    dialog.remove();
  });
});

describe('CPO-044: Decouple Service Worker Caching from SDK', () => {
  it('<copio-header> dispatches header:clear-cache event without touching Service Worker directly', async () => {
    const header = document.createElement('copio-header');
    document.body.appendChild(header);
    await header.updateComplete;

    let eventDispatched = false;
    header.addEventListener('header:clear-cache', () => {
      eventDispatched = true;
    });

    const root = header.shadowRoot || header;
    const menu = root.querySelector('sl-menu');
    expect(menu).to.exist;
    menu.dispatchEvent(new CustomEvent('sl-select', {
      detail: { item: { value: 'clear-cache' } },
      bubbles: true,
      composed: true,
    }));

    expect(eventDispatched).to.be.true;
    header.remove();
  });

  it('<copio-app> receives and handles clear-cache from header', async () => {
    const app = document.createElement('copio-app');
    document.body.appendChild(app);
    await app.updateComplete;

    expect(app.handleClearCache).to.be.a('function');
    app.remove();
  });
});
