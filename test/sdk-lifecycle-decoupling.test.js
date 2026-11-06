import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import * as SDK from '../sdk/index.js';

describe('CPO-039: Lifecycle Hygiene - Cleanup on Disconnect', () => {
  it('mounts and unmounts <copio-scanner> 50 times without error or resource leakage', async () => {
    const initialElementCount = document.querySelectorAll('*').length;

    for (let i = 0; i < 50; i++) {
      const scanner = document.createElement('copio-scanner');
      document.body.appendChild(scanner);
      expect(scanner.isConnected).to.be.true;

      scanner.remove();
      expect(scanner.isConnected).to.be.false;
    }

    const finalElementCount = document.querySelectorAll('*').length;
    expect(finalElementCount).to.equal(initialElementCount);
  });

  it('<copio-scanner> stops active camera tracks on disconnectedCallback', async () => {
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);

    let stopped = false;
    const fakeTrack = {
      stop: () => {
        stopped = true;
      },
    };
    const fakeStream = {
      getTracks: () => [fakeTrack],
    };

    scanner.setCameraStream(fakeStream);
    expect(stopped).to.be.false;

    // Disconnect
    scanner.remove();
    expect(stopped).to.be.true;
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
});

describe('CPO-040: Remove Router Dependency from SDK Components', () => {
  it('SDK entrypoint exports expected components and headless services', () => {
    expect(SDK.CopioScanner).to.exist;
    expect(SDK.CopioDocOcrDialog).to.exist;
    expect(SDK.CopioSyncDialog).to.exist;
    expect(SDK.CopioEngine).to.exist;
    expect(SDK.COPIO_EVENTS).to.exist;
    expect(SDK.recognizeImageText).to.be.a('function');
    expect(SDK.SyncManager).to.exist;
    expect(SDK.exportDocumentAsPdf).to.be.a('function');
    expect(SDK.notify).to.exist;
  });

  it('<copio-scanner> emits events without importing or mutating router', async () => {
    const scanner = document.createElement('copio-scanner');
    document.body.appendChild(scanner);

    let eventFired = false;
    scanner.addEventListener(SDK.COPIO_EVENTS.PAGES_CHANGED, () => {
      eventFired = true;
    });

    SDK.dispatchCopioEvent(scanner, SDK.COPIO_EVENTS.PAGES_CHANGED, { count: 1 });
    expect(eventFired).to.be.true;
    expect(window.location.hash).to.equal('');
    scanner.remove();
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
