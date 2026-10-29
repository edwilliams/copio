import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';

describe('CPO-038: Theming via CSS Custom Properties & Shadow ::part()', () => {
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'theme-test-fixture';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer.remove();
    document.querySelectorAll('style[data-test-theme-css]').forEach((s) => s.remove());
  });

  describe('Theme Configuration API & Attribute Reflection', () => {
    it('defaults to dark theme when no attribute is provided', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      expect(scanner.theme).to.equal('dark');
      const root = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(root);
      // Dark theme background #0b0f17 -> rgb(11, 15, 23)
      expect(computed.backgroundColor).to.equal('rgb(11, 15, 23)');
    });

    it('reflects theme property updates to attribute and vice versa', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      scanner.theme = 'light';
      expect(scanner.getAttribute('theme')).to.equal('light');

      scanner.setAttribute('theme', 'brand');
      expect(scanner.theme).to.equal('brand');
    });
  });

  describe('Default Theme Token Sets (Dark, Light, Brand)', () => {
    it('applies Dark theme design tokens accurately', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('theme', 'dark');
      fixtureContainer.appendChild(scanner);

      const root = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(root);

      expect(computed.getPropertyValue('--copio-color-bg').trim()).to.equal('#0b0f17');
      expect(computed.getPropertyValue('--copio-color-surface').trim()).to.equal('#131b26');
      expect(computed.getPropertyValue('--copio-color-surface-elevated').trim()).to.equal('#1c2736');
      expect(computed.getPropertyValue('--copio-color-stage-bg').trim()).to.equal('#070a0f');
      expect(computed.getPropertyValue('--copio-color-primary').trim()).to.equal('#38bdf8');
      expect(computed.getPropertyValue('--copio-color-success').trim()).to.equal('#22c55e');
      expect(computed.getPropertyValue('--copio-color-danger').trim()).to.equal('#ef4444');
      expect(computed.getPropertyValue('--copio-touch-target-min').trim()).to.equal('44px');
      expect(computed.getPropertyValue('--copio-crop-handle-hit').trim()).to.equal('48px');
    });

    it('applies Light theme design tokens accurately', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('theme', 'light');
      fixtureContainer.appendChild(scanner);

      const root = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(root);

      expect(computed.getPropertyValue('--copio-color-bg').trim()).to.equal('#f8fafc');
      expect(computed.getPropertyValue('--copio-color-surface').trim()).to.equal('#ffffff');
      expect(computed.getPropertyValue('--copio-color-surface-elevated').trim()).to.equal('#f1f5f9');
      expect(computed.getPropertyValue('--copio-color-stage-bg').trim()).to.equal('#1e293b');
      expect(computed.getPropertyValue('--copio-color-primary').trim()).to.equal('#0284c7');
      expect(computed.getPropertyValue('--copio-color-primary-contrast').trim()).to.equal('#ffffff');
      expect(computed.getPropertyValue('--copio-color-success').trim()).to.equal('#16a34a');
      expect(computed.getPropertyValue('--copio-color-danger').trim()).to.equal('#dc2626');
    });

    it('applies Brand (Emerald) theme design tokens accurately', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('theme', 'brand');
      fixtureContainer.appendChild(scanner);

      const root = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(root);

      expect(computed.getPropertyValue('--copio-color-bg').trim()).to.equal('#0f111a');
      expect(computed.getPropertyValue('--copio-color-surface').trim()).to.equal('#181b28');
      expect(computed.getPropertyValue('--copio-color-surface-elevated').trim()).to.equal('#23273a');
      expect(computed.getPropertyValue('--copio-color-stage-bg').trim()).to.equal('#090a10');
      expect(computed.getPropertyValue('--copio-color-primary').trim()).to.equal('#10b981');
      expect(computed.getPropertyValue('--copio-color-primary-contrast').trim()).to.equal('#042f2e');
      expect(computed.getPropertyValue('--copio-radius-sm').trim()).to.equal('4px');
      expect(computed.getPropertyValue('--copio-radius-md').trim()).to.equal('8px');
      expect(computed.getPropertyValue('--copio-radius-lg').trim()).to.equal('12px');
    });
  });

  describe('Shadow Part Exports (::part()) Specification', () => {
    it('exports all 6 required shadow parts: scanner-root, header, viewfinder, shutter-dock, workbench, toolbar', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const shadow = scanner.shadowRoot;
      expect(shadow.querySelector('[part="scanner-root"]')).to.exist;
      expect(shadow.querySelector('[part="header"]')).to.exist;
      expect(shadow.querySelector('[part="viewfinder"]')).to.exist;
      expect(shadow.querySelector('[part="shutter-dock"]')).to.exist;
      expect(shadow.querySelector('[part="workbench"]')).to.exist;
      expect(shadow.querySelector('[part="toolbar"]')).to.exist;
    });

    it('allows external host stylesheets to style elements via ::part() without component code changes', () => {
      const style = document.createElement('style');
      style.setAttribute('data-test-theme-css', '');
      style.textContent = `
        copio-scanner::part(header) {
          border-bottom: 7px solid rgb(255, 0, 128);
        }
        copio-scanner::part(shutter-dock) {
          border-top: 5px solid rgb(0, 255, 128);
        }
      `;
      document.head.appendChild(style);

      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const header = scanner.shadowRoot.querySelector('[part="header"]');
      const shutterDock = scanner.shadowRoot.querySelector('[part="shutter-dock"]');

      const headerComputed = window.getComputedStyle(header);
      const shutterComputed = window.getComputedStyle(shutterDock);

      expect(headerComputed.borderBottomWidth).to.equal('7px');
      expect(headerComputed.borderBottomColor).to.equal('rgb(255, 0, 128)');
      expect(shutterComputed.borderTopWidth).to.equal('5px');
      expect(shutterComputed.borderTopColor).to.equal('rgb(0, 255, 128)');
    });
  });

  describe('Host Context Theming', () => {
    it('activates light theme when host ancestor has data-theme="light"', () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-theme', 'light');
      const scanner = document.createElement('copio-scanner');
      wrapper.appendChild(scanner);
      fixtureContainer.appendChild(wrapper);

      const root = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(root);

      expect(computed.getPropertyValue('--copio-color-primary').trim()).to.equal('#0284c7');
      expect(computed.backgroundColor).to.equal('rgb(248, 250, 252)');
    });

    it('activates brand theme when host ancestor has data-theme="brand"', () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-theme', 'brand');
      const scanner = document.createElement('copio-scanner');
      wrapper.appendChild(scanner);
      fixtureContainer.appendChild(wrapper);

      const root = scanner.shadowRoot.querySelector('.copio-scanner-container');
      const computed = window.getComputedStyle(root);

      expect(computed.getPropertyValue('--copio-color-primary').trim()).to.equal('#10b981');
      expect(computed.backgroundColor).to.equal('rgb(15, 17, 26)');
    });
  });

  describe('Acceptance Criterion: Demo Page Showing 3 Themes with No Component Code Changes', () => {
    it('verifies demo/theming.html exists and showcases dark, light, brand, and custom themes', async () => {
      const response = await fetch('/demo/theming.html');
      expect(response.status).to.equal(200);

      const html = await response.text();
      expect(html).to.include('theme="dark"');
      expect(html).to.include('theme="light"');
      expect(html).to.include('theme="brand"');
      expect(html).to.include('copio-scanner');
      expect(html).to.include('--copio-color-primary');
      expect(html).to.include('::part(');
    });
  });
});
