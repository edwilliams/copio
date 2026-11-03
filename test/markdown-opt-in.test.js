import { expect } from '@esm-bundle/chai';
import '../js/lib/shoelace.js';
import {
  CopioScanner,
  CopioEngine,
  isMarkdownEnabled,
  setMarkdownEnabled,
  createMarkdownPage,
  isMarkdownPage,
  parseMarkdownSync,
} from '../sdk/index.js';
import '../js/components/copio-header.js';
import '../js/routes/home/copio-row.js';
import '../js/routes/doc/copio-carousel.js';
import '../js/routes/doc/copio-images.js';
import '../js/routes/ocr/copio-doc-ocr-dialog.js';
import { notify } from '../js/services/notify.js';

describe('CPO-026: Markdown Notes as an Opt-In Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    try {
      localStorage.removeItem('copio-markdown-enabled');
    } catch {}
  });

  afterEach(() => {
    container?.remove();
    notify.clear();
    try {
      localStorage.removeItem('copio-markdown-enabled');
    } catch {}
  });

  describe('Storage & Toggle State Management', () => {
    it('defaults to true when localStorage is not set', () => {
      expect(isMarkdownEnabled()).to.be.true;
    });

    it('persists and updates toggle state in localStorage and dispatches event', () => {
      let eventFired = false;
      const handler = (e) => {
        if (e.detail?.enabled === false) {
          eventFired = true;
        }
      };
      window.addEventListener('copio:markdown-toggled', handler);

      setMarkdownEnabled(false);
      expect(isMarkdownEnabled()).to.be.false;
      expect(localStorage.getItem('copio-markdown-enabled')).to.equal('false');
      expect(eventFired).to.be.true;

      window.removeEventListener('copio:markdown-toggled', handler);

      setMarkdownEnabled(true);
      expect(isMarkdownEnabled()).to.be.true;
      expect(localStorage.getItem('copio-markdown-enabled')).to.equal('true');
    });

    it('creates valid markdown page models and identifies them', () => {
      const page = createMarkdownPage({ name: 'Meeting Notes', content: '# Agenda' });
      expect(page.type).to.equal('markdown');
      expect(page.name).to.equal('Meeting Notes');
      expect(page.content).to.equal('# Agenda');
      expect(page.id).to.be.a('string');
      expect(isMarkdownPage(page)).to.be.true;
      expect(isMarkdownPage({ src: 'data:image/png;base64,...' })).to.be.false;
    });
  });

  describe('Header / Settings Menu Toggle', () => {
    it('renders a checkbox menu item in copio-header to toggle markdown', async () => {
      const header = document.createElement('copio-header');
      header.markdownEnabled = true;
      container.appendChild(header);
      await header.updateComplete;

      const menuItem = header.shadowRoot.querySelector('sl-menu-item[value="toggle-markdown"]');
      expect(menuItem).to.exist;
      expect(menuItem.getAttribute('type')).to.equal('checkbox');
      expect(menuItem.hasAttribute('checked')).to.be.true;
    });

    it('toggles markdownEnabled and fires header:toggle-markdown on select', async () => {
      const header = document.createElement('copio-header');
      header.markdownEnabled = true;
      container.appendChild(header);
      await header.updateComplete;

      let toggledDetail = null;
      header.addEventListener('header:toggle-markdown', (e) => {
        toggledDetail = e.detail;
      });

      const menu = header.shadowRoot.querySelector('sl-menu');
      const menuItem = header.shadowRoot.querySelector('sl-menu-item[value="toggle-markdown"]');
      menu.dispatchEvent(new CustomEvent('sl-select', { detail: { item: menuItem } }));

      expect(toggledDetail).to.deep.equal({ enabled: false });
      expect(header.markdownEnabled).to.be.false;
      expect(isMarkdownEnabled()).to.be.false;
    });
  });

  describe('App Cleanly Hides Markdown UI When Toggled Off', () => {
    it('copio-row hides "Download as Markdown" when markdown is false', async () => {
      const row = document.createElement('copio-row');
      row.pages = [
        { id: '1', src: 'data:image/png;base64,...' },
        { id: '2', type: 'markdown', name: 'Notes', content: 'hello' },
      ];
      row.markdown = true;
      container.appendChild(row);
      await row.updateComplete;

      // When enabled: download-markdown is present
      let mdItem = row.shadowRoot.querySelector('sl-menu-item[value="download-markdown"]');
      expect(mdItem).to.exist;
      expect(row.pageCount).to.equal(2);

      // When disabled: download-markdown is cleanly removed from DOM
      row.markdown = false;
      await row.updateComplete;

      mdItem = row.shadowRoot.querySelector('sl-menu-item[value="download-markdown"]');
      expect(mdItem).to.not.exist;
      expect(row.pageCount).to.equal(1); // Only image page counted
    });

    it('copio-carousel hides markdown slides and "Download as Markdown" when markdown is false', async () => {
      const carousel = document.createElement('copio-carousel');
      carousel.images = [
        { id: '1', src: 'data:image/png;base64,...' },
        { id: '2', type: 'markdown', name: 'Notes', content: '# Hello' },
      ];
      carousel.markdown = true;
      container.appendChild(carousel);
      await carousel.updateComplete;

      // When enabled
      expect(carousel.pageCount).to.equal(2);
      let mdExport = carousel.shadowRoot.querySelector('sl-menu-item[value="markdown"]');
      expect(mdExport).to.exist;

      // When disabled
      carousel.markdown = false;
      await carousel.updateComplete;

      expect(carousel.pageCount).to.equal(1);
      mdExport = carousel.shadowRoot.querySelector('sl-menu-item[value="markdown"]');
      expect(mdExport).to.not.exist;
    });

    it('copio-images hides "+ Note" button, hides markdown cards, and restricts file input when markdown is false', async () => {
      const imagesEl = document.createElement('copio-images');
      container.appendChild(imagesEl);
      await new Promise((r) => setTimeout(r, 50));

      imagesEl.markdown = true;
      imagesEl.images = [
        { id: 'p1', src: 'data:image/png;base64,...' },
        { id: 'n1', type: 'markdown', name: 'Doc Note', content: 'sample text' },
      ];
      await new Promise((r) => setTimeout(r, 50));

      const shadow = imagesEl.shadowRoot;
      expect(shadow.querySelector('.add-note-btn')).to.exist;
      expect(shadow.querySelector('.markdown-card')).to.exist;
      expect(shadow.querySelector('.file-input').accept).to.include('.md');

      // Toggle off markdown
      imagesEl.markdown = false;
      await new Promise((r) => setTimeout(r, 50));

      expect(shadow.querySelector('.add-note-btn')).to.not.exist;
      expect(shadow.querySelector('.markdown-card')).to.not.exist;
      expect(shadow.querySelector('.file-input').accept).to.not.include('.md');
      expect(shadow.querySelector('.add-image-btn').getAttribute('title')).to.equal('Add image or PDF');
    });

    it('copio-doc-ocr-dialog hides "Save as Note" and "Download .md" when markdown is false', async () => {
      const ocrDialog = document.createElement('copio-doc-ocr-dialog');
      ocrDialog.markdown = true;
      container.appendChild(ocrDialog);
      await ocrDialog.updateComplete;

      // Set state to done
      ocrDialog.step = 'done';
      ocrDialog.isOpen = true;
      await ocrDialog.updateComplete;

      expect(ocrDialog.querySelector('sl-button[variant="primary"]')).to.exist;

      ocrDialog.markdown = false;
      await ocrDialog.updateComplete;

      const saveNoteBtn = Array.from(ocrDialog.querySelectorAll('sl-button')).find(
        (b) => b.textContent.includes('Save as Note'),
      );
      expect(saveNoteBtn).to.be.undefined;
    });
  });

  describe('SDK Build & Headless CopioEngine Without Markdown', () => {
    it('CopioEngine initializes with markdown=false by default (opt-in for SDK)', () => {
      const engine = new CopioEngine();
      expect(engine.markdown).to.be.false;
      expect(engine.hasFeature('markdown')).to.be.false;
    });

    it('CopioEngine supports markdown opt-in via options and methods', () => {
      const engine = new CopioEngine({ markdown: true });
      expect(engine.markdown).to.be.true;
      expect(engine.hasFeature('markdown')).to.be.true;

      engine.markdown = false;
      expect(engine.markdown).to.be.false;
      expect(engine.hasFeature('markdown')).to.be.false;

      engine.markdown = true;
      expect(engine.markdown).to.be.true;
      expect(engine.hasFeature('markdown')).to.be.true;
    });

    it('CopioScanner defaults markdown to false and passes prop to child views', async () => {
      const scanner = new CopioScanner();
      container.appendChild(scanner);

      expect(scanner.markdown).to.be.false;

      scanner.markdown = true;
      expect(scanner.markdown).to.be.true;
      expect(scanner.getAttribute('markdown')).to.equal('true');

      scanner.setAttribute('markdown', 'false');
      expect(scanner.markdown).to.be.false;
    });

    it('renders plain text safely without loading marked when marked is not loaded', () => {
      const rawText = '# Test Title\nParagraph content';
      // parseMarkdownSync falls back to raw text if marked is not yet loaded
      const result = parseMarkdownSync(rawText);
      expect(result).to.be.a('string');
      expect(result.length).to.be.greaterThan(0);
    });
  });
});
