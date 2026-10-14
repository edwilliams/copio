import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import '../js/core/register-components.js';
import notify, { setContainer, getContainer, clear } from '../js/services/notify.js';

describe('Unified Toast / Feedback Service (CPO-022)', () => {
  beforeEach(() => {
    setContainer(null);
    clear();
  });

  afterEach(() => {
    clear();
    setContainer(null);
  });

  it('renders a success toast with correct variant and icon', async () => {
    const alert = await notify.success('Document saved successfully');
    expect(alert).to.exist;
    expect(alert.tagName.toLowerCase()).to.equal('sl-alert');
    expect(alert.variant).to.equal('success');
    expect(alert.duration).to.equal(3000);

    const icon = alert.querySelector('sl-icon[slot="icon"]');
    expect(icon).to.exist;
    expect(icon.name).to.equal('check-circle');

    const text = alert.textContent;
    expect(text).to.include('Document saved successfully');
  });

  it('renders an error toast with danger variant and exclamation-octagon icon', async () => {
    const alert = await notify.error('Failed to export PDF');
    expect(alert).to.exist;
    expect(alert.variant).to.equal('danger');
    expect(alert.duration).to.equal(5000);

    const icon = alert.querySelector('sl-icon[slot="icon"]');
    expect(icon).to.exist;
    expect(icon.name).to.equal('exclamation-octagon');
    expect(alert.textContent).to.include('Failed to export PDF');
  });

  it('renders a warning toast with warning variant and exclamation-triangle icon', async () => {
    const alert = await notify.warning('No pages to export');
    expect(alert).to.exist;
    expect(alert.variant).to.equal('warning');
    expect(alert.duration).to.equal(4000);

    const icon = alert.querySelector('sl-icon[slot="icon"]');
    expect(icon).to.exist;
    expect(icon.name).to.equal('exclamation-triangle');
    expect(alert.textContent).to.include('No pages to export');
  });

  it('renders an info toast with primary variant and info-circle icon', async () => {
    const alert = await notify.info('Sync in progress');
    expect(alert).to.exist;
    expect(alert.variant).to.equal('primary');
    expect(alert.duration).to.equal(4000);

    const icon = alert.querySelector('sl-icon[slot="icon"]');
    expect(icon).to.exist;
    expect(icon.name).to.equal('info-circle');
    expect(alert.textContent).to.include('Sync in progress');
  });

  it('renders an undo toast and triggers callback when action clicked', async () => {
    let undoTriggered = false;
    const alert = await notify.undo('Page deleted', () => {
      undoTriggered = true;
    });

    expect(alert).to.exist;
    expect(alert.variant).to.equal('primary');
    expect(alert.duration).to.equal(5000);

    const icon = alert.querySelector('sl-icon[slot="icon"]');
    expect(icon).to.exist;
    expect(icon.name).to.equal('arrow-counterclockwise');

    const button = alert.querySelector('sl-button');
    expect(button).to.exist;
    expect(button.textContent.trim()).to.equal('Undo');

    button.click();
    expect(undoTriggered).to.be.true;
  });

  it('supports custom actions with custom text and handlers', async () => {
    let actionClicked = false;
    const alert = await notify.info('Update available', {
      duration: Infinity,
      action: {
        text: 'Reload',
        onClick: () => {
          actionClicked = true;
        },
      },
    });

    const button = alert.querySelector('sl-button');
    expect(button).to.exist;
    expect(button.textContent.trim()).to.equal('Reload');

    button.click();
    expect(actionClicked).to.be.true;
  });

  it('scopes toasts to a custom container for SDK / embedded mode', async () => {
    const customContainer = document.createElement('div');
    customContainer.id = 'sdk-scanner-host';
    customContainer.style.position = 'relative';
    document.body.appendChild(customContainer);

    try {
      setContainer(customContainer);
      expect(getContainer()).to.equal(customContainer);

      const alert = await notify.success('Scoped to container');
      const SlAlert = customElements.get('sl-alert');
      const stack = SlAlert.toastStack;

      expect(stack.parentElement).to.equal(customContainer);
      expect(stack.style.position).to.equal('absolute');
      expect(stack.contains(alert)).to.be.true;
    } finally {
      customContainer.remove();
      setContainer(null);
    }
  });

  it('clear() dismisses active toasts', async () => {
    const alert1 = await notify.info('Toast 1', { duration: 10000 });
    const alert2 = await notify.info('Toast 2', { duration: 10000 });

    let hide1Called = false;
    let hide2Called = false;
    const origHide1 = alert1.hide;
    const origHide2 = alert2.hide;
    alert1.hide = function () {
      hide1Called = true;
      return origHide1.apply(this, arguments);
    };
    alert2.hide = function () {
      hide2Called = true;
      return origHide2.apply(this, arguments);
    };

    clear();
    expect(hide1Called).to.be.true;
    expect(hide2Called).to.be.true;
  });

  it('allows notify() as a direct function call', async () => {
    const alert = await notify('Quick message', { variant: 'success' });
    expect(alert).to.exist;
    expect(alert.variant).to.equal('success');
    expect(alert.textContent).to.include('Quick message');
  });

  describe('Asynchronous Action Feedback (Acceptance Criteria)', () => {
    let capturedToasts = [];
    let origShow;

    beforeEach(() => {
      capturedToasts = [];
      origShow = notify.show;
      notify.show = (msgOrOpts, opts) => {
        const item = typeof msgOrOpts === 'string' ? { message: msgOrOpts, ...opts } : { ...msgOrOpts, ...opts };
        capturedToasts.push(item);
        return origShow(msgOrOpts, opts);
      };
    });

    afterEach(() => {
      notify.show = origShow;
      clear();
    });

    it('gives feedback when files are imported in copio-images', async () => {
      const el = document.createElement('copio-images');
      document.body.appendChild(el);

      try {
        const file = new File(['# Title\nNote text'], 'meeting.md', { type: 'text/markdown' });
        await el.addFiles([file]);

        expect(capturedToasts.some((t) => t.variant === 'success' && t.message.includes('Imported 1 page'))).to.be.true;
      } finally {
        el.remove();
      }
    });

    it('gives feedback when OCR actions (copy, save note) are performed', async () => {
      const ocrDialog = document.createElement('copio-doc-ocr-dialog');
      document.body.appendChild(ocrDialog);

      try {
        ocrDialog.docId = 'test-doc';
        ocrDialog.docName = 'Test Document';
        ocrDialog.resultText = 'Recognized sample text';

        // Test copy with stubbed clipboard
        const origWriteText = navigator.clipboard.writeText;
        try {
          navigator.clipboard.writeText = async () => {};
          await ocrDialog.copyText();
          expect(capturedToasts.some((t) => t.variant === 'success' && t.message.includes('Copied text'))).to.be.true;
        } finally {
          navigator.clipboard.writeText = origWriteText;
        }

        // Test save note
        let noteSaved = false;
        ocrDialog.addEventListener('copio-ocr:save-note', () => {
          noteSaved = true;
        });
        ocrDialog.saveAsNote();
        expect(noteSaved).to.be.true;
        expect(capturedToasts.some((t) => t.variant === 'success' && t.message.includes('Saved OCR text'))).to.be.true;
      } finally {
        ocrDialog.remove();
      }
    });

    it('gives feedback when sync is triggered offline', async () => {
      const { SyncManager } = await import('../js/services/sync-service.js');
      const fakeStore = { getTable: () => ({}) };
      const manager = new SyncManager(fakeStore, () => {});

      const origOnLine = navigator.onLine;
      try {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        manager.startHost();

        expect(capturedToasts.some((t) => t.variant === 'warning' && t.message.includes('internet connection'))).to.be.true;
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: origOnLine, configurable: true });
        manager.close();
      }
    });

    it('renders a progress toast with progress bar and updates dynamically', async () => {
      const handle = await notify.progress({
        message: 'Exporting files...',
        done: 2,
        total: 10,
      });

      expect(handle).to.exist;
      expect(handle.alert).to.exist;
      expect(handle.alert.tagName.toLowerCase()).to.equal('sl-alert');
      expect(handle.progressBar).to.exist;
      expect(handle.progressBar.value).to.equal(20);

      const statusEl = handle.alert.querySelector('.notify-progress-status');
      expect(statusEl.textContent).to.equal('2 / 10');

      // Update progress
      handle.update({ done: 5, total: 10, message: 'Halfway done...' });
      expect(handle.progressBar.value).to.equal(50);
      expect(statusEl.textContent).to.equal('5 / 10');
      const msgEl = handle.alert.querySelector('.notify-progress-message');
      expect(msgEl.textContent).to.equal('Halfway done...');

      // Close progress
      handle.close();
    });
  });
});


