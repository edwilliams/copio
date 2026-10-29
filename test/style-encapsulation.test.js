import { expect } from '@esm-bundle/chai';
import {
  getScannerStyleSheet,
  adoptScannerStyles,
} from '../sdk/index.js';
import '../js/routes/doc/copio-images.js';

describe('CPO-032: Style Encapsulation & Host Isolation', () => {
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'test-fixture-container';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    // Clean up all test fixtures and any test style injections
    fixtureContainer.remove();
    const injectedStyles = document.querySelectorAll('style[data-test-host-css]');
    injectedStyles.forEach((s) => s.remove());
  });

  describe('Constructable Stylesheets & adoptedStyleSheets Architecture', () => {
    it('provides valid constructable CSSStyleSheet with parsed rules', () => {
      const sheet = getScannerStyleSheet();
      expect(sheet).to.exist;
      expect(sheet instanceof CSSStyleSheet).to.be.true;
      expect(sheet.cssRules.length).to.be.greaterThan(0);

      // Verify key rules are present in sheet
      const rulesText = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      expect(rulesText).to.include(':host');
      expect(rulesText).to.include('--copio-color-primary');
      expect(rulesText).to.include('copio-scanner');
    });

    it('adopts stylesheet onto shadowRoot with idempotency', () => {
      const el = document.createElement('copio-scanner');
      fixtureContainer.appendChild(el);

      expect(el.shadowRoot).to.exist;
      const sheet = getScannerStyleSheet();

      // Should have adopted the stylesheet
      expect(el.shadowRoot.adoptedStyleSheets).to.include(sheet);
      const initialCount = el.shadowRoot.adoptedStyleSheets.length;

      // Adopting again must be idempotent (no duplicate sheets added)
      adoptScannerStyles(el.shadowRoot);
      expect(el.shadowRoot.adoptedStyleSheets.length).to.equal(initialCount);
    });

    it('shares a single cached CSSStyleSheet across multiple scanner instances', () => {
      const el1 = document.createElement('copio-scanner');
      const el2 = document.createElement('copio-scanner');
      fixtureContainer.appendChild(el1);
      fixtureContainer.appendChild(el2);

      const sheet1 = el1.shadowRoot.adoptedStyleSheets[0];
      const sheet2 = el2.shadowRoot.adoptedStyleSheets[0];

      // Must be pointer-identical (zero memory duplication)
      expect(sheet1).to.equal(sheet2);
      expect(sheet1).to.equal(getScannerStyleSheet());
    });
  });

  describe('Acceptance Criterion 1: Host CSS Isolation', () => {
    let aggressiveHostStyle;

    beforeEach(() => {
      aggressiveHostStyle = document.createElement('style');
      aggressiveHostStyle.setAttribute('data-test-host-css', 'aggressive');
      aggressiveHostStyle.textContent = `
        * {
          all: revert !important;
        }
        *, *::before, *::after {
          box-sizing: content-box !important;
          margin: 31px !important;
          padding: 27px !important;
        }
        button, input, [role="button"] {
          background-color: rgb(255, 0, 128) !important;
          color: rgb(0, 255, 255) !important;
          border: 11px solid rgb(255, 255, 0) !important;
          border-radius: 0px !important;
          font-size: 47px !important;
        }
        body {
          font-size: 53px !important;
          color: rgb(255, 0, 0) !important;
          line-height: 4 !important;
          text-align: right !important;
        }
      `;
      document.head.appendChild(aggressiveHostStyle);
    });

    afterEach(() => {
      aggressiveHostStyle.remove();
    });

    it('protects shadow DOM elements from aggressive host wildcards and resets', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      // Add a test element inside the shadow root
      const testBtn = document.createElement('button');
      testBtn.className = 'copio-btn';
      testBtn.textContent = 'Capture';
      scanner.shadowRoot.querySelector('.copio-scanner-container').appendChild(testBtn);

      const btnComputed = window.getComputedStyle(testBtn);
      const containerComputed = window.getComputedStyle(
        scanner.shadowRoot.querySelector('.copio-scanner-container')
      );

      // 1. Box-sizing must remain border-box inside shadow root
      expect(containerComputed.boxSizing).to.equal('border-box');
      expect(btnComputed.boxSizing).to.equal('border-box');

      // 2. Host margin/padding (31px / 27px) must NOT apply to shadow DOM elements
      expect(btnComputed.marginTop).to.not.equal('31px');
      expect(btnComputed.paddingTop).to.not.equal('27px');

      // 3. Host button overrides (magenta background, cyan text, 11px yellow border) must NOT penetrate
      expect(btnComputed.backgroundColor).to.not.equal('rgb(255, 0, 128)');
      expect(btnComputed.color).to.not.equal('rgb(0, 255, 255)');
      expect(btnComputed.borderTopWidth).to.not.equal('11px');

      // 4. Touch target invariant (>= 44px) must hold even under hostile host CSS
      expect(testBtn.offsetHeight).to.be.at.least(44);
    });

    it('isolates inherited typography and alignment at the shadow boundary', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const containerComputed = window.getComputedStyle(
        scanner.shadowRoot.querySelector('.copio-scanner-container')
      );

      // Shadow container isolates host text-align: right, color: red, and massive font-size
      expect(containerComputed.textAlign).to.equal('left');
      expect(containerComputed.color).to.not.equal('rgb(255, 0, 0)');
      expect(containerComputed.fontSize).to.not.equal('53px');
      expect(containerComputed.lineHeight).to.not.equal('212px'); // 53px * 4
    });

    it('preserves container-type: size context under aggressive host CSS', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.style.width = '360px';
      scanner.style.height = '640px';
      fixtureContainer.appendChild(scanner);

      const containerComputed = window.getComputedStyle(
        scanner.shadowRoot.querySelector('.copio-scanner-container')
      );
      expect(containerComputed.containerType).to.include('size');
      expect(containerComputed.containerName).to.include('copio-scanner');
    });
  });

  describe('Acceptance Criterion 2: Zero Global Style Leakage into Host Document', () => {
    it('does not inject global <style> or <link> tags into host document.head or body', () => {
      const initialHeadChildren = Array.from(document.head.children);
      const initialBodyStyles = Array.from(document.body.querySelectorAll('style, link[rel="stylesheet"]'));

      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const newHeadChildren = Array.from(document.head.children).filter(
        (el) => !initialHeadChildren.includes(el)
      );
      const newBodyStyles = Array.from(document.body.querySelectorAll('style, link[rel="stylesheet"]')).filter(
        (el) => !initialBodyStyles.includes(el) && !scanner.contains(el)
      );

      // Scanner must not add any stylesheet to document.head or outside its shadowRoot
      expect(newHeadChildren.filter((el) => el.tagName === 'STYLE' || el.tagName === 'LINK')).to.be.empty;
      expect(newBodyStyles).to.be.empty;
    });

    it('does not contaminate document.adoptedStyleSheets', () => {
      const initialDocSheets = Array.from(document.adoptedStyleSheets || []);

      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const sheet = getScannerStyleSheet();
      // Document adoptedStyleSheets must not contain scanner sheet
      expect(document.adoptedStyleSheets).to.not.include(sheet);
      expect(document.adoptedStyleSheets.length).to.equal(initialDocSheets.length);
    });

    it('leaves host elements outside <copio-scanner> completely unstyled by Copio', () => {
      const hostSection = document.createElement('section');
      hostSection.id = 'host-native-section';
      hostSection.innerHTML = `
        <h2 class="host-h2">Host Native Heading</h2>
        <button class="host-button">Host Native Button</button>
      `;
      fixtureContainer.appendChild(hostSection);

      const hostBtn = hostSection.querySelector('.host-button');
      const hostH2 = hostSection.querySelector('.host-h2');

      const btnBefore = {
        fontFamily: window.getComputedStyle(hostBtn).fontFamily,
        backgroundColor: window.getComputedStyle(hostBtn).backgroundColor,
      };
      const h2Before = {
        fontSize: window.getComputedStyle(hostH2).fontSize,
      };

      // Mount scanner alongside host elements
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const btnAfter = {
        fontFamily: window.getComputedStyle(hostBtn).fontFamily,
        backgroundColor: window.getComputedStyle(hostBtn).backgroundColor,
      };
      const h2After = {
        fontSize: window.getComputedStyle(hostH2).fontSize,
      };

      // Host elements must be completely unaffected
      expect(btnAfter.fontFamily).to.equal(btnBefore.fontFamily);
      expect(btnAfter.backgroundColor).to.equal(btnBefore.backgroundColor);
      expect(h2After.fontSize).to.equal(h2Before.fontSize);
    });
  });

  describe('Theme Customization & Shadow ::part() Tokens', () => {
    it('cascades --copio-* CSS custom properties through the shadow boundary', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.style.setProperty('--copio-color-primary', '#e11d48');
      fixtureContainer.appendChild(scanner);

      const testBtn = document.createElement('button');
      testBtn.className = 'copio-btn copio-btn-primary';
      testBtn.textContent = 'Custom Primary';
      scanner.shadowRoot.querySelector('.copio-scanner-container').appendChild(testBtn);

      const computed = window.getComputedStyle(testBtn);
      // rgb(225, 29, 72) is #e11d48
      expect(computed.backgroundColor).to.equal('rgb(225, 29, 72)');
    });

    it('activates light theme via theme="light" attribute', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('theme', 'light');
      fixtureContainer.appendChild(scanner);

      const container = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(container);

      // Light theme background is #f8fafc -> rgb(248, 250, 252)
      expect(computed.backgroundColor).to.equal('rgb(248, 250, 252)');
      // Light theme text is #0f172a -> rgb(15, 23, 42)
      expect(computed.color).to.equal('rgb(15, 23, 42)');
    });

    it('activates brand theme via class="copio-theme-brand"', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.className = 'copio-theme-brand';
      fixtureContainer.appendChild(scanner);

      const container = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(container);

      // Brand theme background is #0f111a -> rgb(15, 17, 26)
      expect(computed.backgroundColor).to.equal('rgb(15, 17, 26)');
    });
  });

  describe('Crop Overlay Encapsulation', () => {
    it('encapsulates cropper styles inside copio-images shadowRoot without external <link>', () => {
      const imagesEl = document.createElement('copio-images');
      fixtureContainer.appendChild(imagesEl);

      expect(imagesEl.shadowRoot).to.exist;

      // Verify no relative <link rel="stylesheet" href="css/cropper.css"> is present
      const externalLink = imagesEl.shadowRoot.querySelector('link[rel="stylesheet"][href*="cropper"]');
      expect(externalLink).to.be.null;

      // Verify cropper rules exist inside shadowRoot style tags
      const shadowStyles = Array.from(imagesEl.shadowRoot.querySelectorAll('style'))
        .map((s) => s.textContent)
        .join('\n');
      expect(shadowStyles).to.include('.cropper-container');
      expect(shadowStyles).to.include('.cropper-view-box');
      expect(shadowStyles).to.include('.cropper-point');
    });
  });
});
