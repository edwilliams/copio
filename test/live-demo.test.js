import { expect } from '@esm-bundle/chai';

function waitForIframeLoad(iframe) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out loading /index.html iframe')), 8000);
    iframe.addEventListener(
      'load',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function wait(ms = 40) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CPO-085: Live Interactive Demo (Dynamic Snippet & StackBlitz Links)', () => {
  let iframe;

  afterEach(() => {
    if (iframe) {
      iframe.remove();
      iframe = null;
    }
  });

  it('includes 1-click StackBlitz & Codespaces links for all frameworks in index.html', async () => {
    const res = await fetch('/index.html');
    expect(res.status).to.equal(200);
    const html = await res.text();

    const expectedLinks = [
      'https://stackblitz.com/github/edwilliams/copio/tree/master/examples/vanilla',
      'https://stackblitz.com/github/edwilliams/copio/tree/master/examples/react',
      'https://stackblitz.com/github/edwilliams/copio/tree/master/examples/vue',
      'https://stackblitz.com/github/edwilliams/copio/tree/master/examples/angular',
      'https://codespaces.new/edwilliams/copio',
    ];

    for (const url of expectedLinks) {
      expect(html).to.include(`href="${url}"`);
    }

    expect(html).to.include('data-container-btn="inline"');
    expect(html).to.include('id="dynamic-code-snippet"');
    expect(html).to.include('id="custom-accent-input"');
  });

  it('dynamically updates the live code snippet to match selected host mode and theme tokens', async () => {
    iframe = document.createElement('iframe');
    iframe.style.width = '1280px';
    iframe.style.height = '800px';
    iframe.src = '/index.html';
    document.body.appendChild(iframe);

    await waitForIframeLoad(iframe);
    await wait(150);

    const doc = iframe.contentDocument;
    const snippetEl = doc.getElementById('dynamic-code-snippet');
    expect(snippetEl).to.exist;

    // Initial state: modal + dark theme
    expect(snippetEl.textContent).to.include('.copio-modal');
    expect(snippetEl.textContent).to.include('width: 360px;');
    expect(snippetEl.textContent).to.include('theme="dark"');
    expect(snippetEl.textContent).to.include('--copio-color-primary: #38bdf8;');

    // Switch host mode to drawer
    doc.querySelector('[data-container-btn="drawer"]').click();
    await wait(30);
    expect(snippetEl.textContent).to.include('.copio-drawer');
    expect(snippetEl.textContent).to.include('width: 480px;');

    // Switch host mode to inline card
    doc.querySelector('[data-container-btn="inline"]').click();
    await wait(30);
    expect(snippetEl.textContent).to.include('.copio-inline-card');
    expect(snippetEl.textContent).to.include('width: 440px;');

    // Switch host mode to full view
    doc.querySelector('[data-container-btn="full"]').click();
    await wait(30);
    expect(snippetEl.textContent).to.include('.copio-full-view');
    expect(snippetEl.textContent).to.include('height: 100dvh;');

    // Switch theme to light
    doc.querySelector('[data-theme-btn="light"]').click();
    await wait(30);
    expect(snippetEl.textContent).to.include('theme="light"');
    expect(snippetEl.textContent).to.include('--copio-color-bg: #f8fafc;');
    expect(snippetEl.textContent).to.include('--copio-color-primary: #0284c7;');

    // Switch theme to brand (emerald)
    doc.querySelector('[data-theme-btn="brand"]').click();
    await wait(30);
    expect(snippetEl.textContent).to.include('theme="brand"');
    expect(snippetEl.textContent).to.include('--copio-color-primary: #10b981;');

    // Customize accent color token
    const accentInput = doc.getElementById('custom-accent-input');
    accentInput.value = '#e11d48';
    accentInput.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
    await wait(30);
    expect(snippetEl.textContent).to.include('--copio-color-primary: #e11d48;');
  });
});
