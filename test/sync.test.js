import { expect } from '@esm-bundle/chai';
import { createStore } from '../js/lib/tinybase.6.5.2.js';
import { SyncManager } from '../js/services/sync-service.js';
import '../js/routes/sync/copio-sync-dialog.js';
import '../js/components/copio-app.js';
import { router } from '../js/core/router.js';

describe('SyncManager P2P', function () {
  this.timeout(20000);

  it('should sync documents between host and joiner', async () => {
    const storeHost = createStore();
    const sampleImage = 'data:image/jpeg;base64,' + 'A'.repeat(300 * 1024);
    storeHost.setTable('docs', {
      doc1: {
        name: 'Host Doc',
        pages: JSON.stringify([{ id: 'p1', src: sampleImage, type: 'image' }])
      }
    });

    const storeJoiner = createStore();
    storeJoiner.setTable('docs', {
      doc2: { name: 'Joiner Doc', pages: '[]' }
    });

    let hostState = null;
    let joinerState = null;

    const hostManager = new SyncManager(storeHost, (state) => {
      hostState = state;
    });

    const joinerManager = new SyncManager(storeJoiner, (state) => {
      joinerState = state;
    });

    hostManager.startHost();

    // Wait for host to get ID
    await new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (hostState?.step === 'waiting') {
          clearInterval(interval);
          resolve();
        } else if (hostState?.step === 'error') {
          clearInterval(interval);
          reject(new Error(hostState.message));
        }
      }, 100);
    });

    const hostPeerId = hostState.peerId;
    expect(hostPeerId).to.be.a('string');
    expect(hostState.url).to.include(`peer=${hostPeerId}`);

    joinerManager.startJoiner(hostPeerId);

    // Wait for both to reach 'done' or 'error'
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for sync. Host step: ${hostState?.step}, Joiner step: ${joinerState?.step}`));
      }, 15000);

      const interval = setInterval(() => {
        if (hostState?.step === 'error' || joinerState?.step === 'error') {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error(`Host error: ${hostState?.message}, Joiner error: ${joinerState?.message}`));
        } else if (hostState?.step === 'done' && joinerState?.step === 'done') {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });

    expect(storeHost.hasRow('docs', 'doc2')).to.be.true;
    expect(storeJoiner.hasRow('docs', 'doc1')).to.be.true;

    // Clean up
    hostManager.close();
    joinerManager.close();
  });
});

describe('CopioSyncDialog UI & App Integration', () => {
  it('renders QR code and link below QR code in waiting step', async () => {
    const dialog = document.createElement('copio-sync-dialog');
    dialog.syncState = {
      mode: 'host',
      step: 'waiting',
      qrSvg: '<svg id="test-qr"></svg>',
      url: 'https://example.com/?peer=abc-123',
    };
    document.body.appendChild(dialog);
    await dialog.updateComplete;

    const qr = dialog.querySelector('#test-qr');
    expect(qr).to.exist;

    const link = dialog.querySelector('.sync-link');
    expect(link).to.exist;
    expect(link.getAttribute('href')).to.equal('https://example.com/?peer=abc-123');
    expect(link.textContent.trim()).to.equal('https://example.com/?peer=abc-123');

    dialog.remove();
  });

  it('footer Close button triggers close event', async () => {
    const dialog = document.createElement('copio-sync-dialog');
    dialog.syncState = {
      mode: 'host',
      step: 'waiting',
      qrSvg: '<svg></svg>',
      url: 'https://example.com/?peer=123',
    };
    document.body.appendChild(dialog);
    await dialog.updateComplete;

    let closed = false;
    dialog.addEventListener('dialog:close', () => {
      closed = true;
    });

    const closeBtn = dialog.querySelector('.sync-close-btn');
    expect(closeBtn).to.exist;
    closeBtn.click();

    // sl-dialog hide is async or handleCloseClick falls back
    await new Promise((r) => setTimeout(r, 100));
    expect(closed).to.be.true;

    dialog.remove();
  });

  it('CopioApp handles sync-dialog:close, resets router hash and destroys sync session', async () => {
    const app = document.createElement('copio-app');
    document.body.appendChild(app);
    await app.updateComplete;

    // Navigate to /sync
    router.navigate('/sync');
    await new Promise((r) => setTimeout(r, 100));
    await app.updateComplete;
    expect(router.getHashPath()).to.equal('/sync');
    expect(app.syncState).to.exist;

    // Trigger closeSyncDialog on app
    app.closeSyncDialog();
    await app.updateComplete;

    // Router must navigate back to '/' and syncState cleared
    expect(router.getHashPath()).to.equal('/');
    expect(app.syncState).to.be.null;

    app.remove();
  });
});
