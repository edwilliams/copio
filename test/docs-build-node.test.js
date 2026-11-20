import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildDocs, highlightCode, parseFrontmatter, renderMarkdown } from '../scripts/build-docs.mjs';
import { searchEntries } from '../docs-site/assets/docs.js';

describe('CPO-080: Docs site scaffold & search', () => {
  it('parses frontmatter and renders markdown with heading anchors and code blocks', () => {
    const sample = `---
title: Test Page
section: Overview
order: 1
---

# Hello World

## Install \`@copio/sdk\`

\`\`\`bash
npm install @copio/sdk
\`\`\`
`;
    const { meta, body } = parseFrontmatter(sample);
    assert.equal(meta.title, 'Test Page');
    assert.equal(meta.order, 1);

    const { html, headings } = renderMarkdown(body);
    assert.equal(headings.length, 1);
    assert.equal(headings[0].id, 'install-copiosdk');
    assert.ok(html.includes('data-copy-code'));
    assert.ok(html.includes('<span class="tok-keyword">npm</span> install @copio/sdk'));

    const highlightedJs = highlightCode("import { CopioEngine } from '@copio/sdk';", 'js');
    assert.ok(highlightedJs.includes('tok-keyword'));
    assert.ok(highlightedJs.includes('tok-string'));
  });

  it('builds dist/docs/ with all pages, live embeds, and valid search-index.json', async () => {
    const result = await buildDocs();
    assert.ok(result.pages.includes('index'));
    assert.ok(result.pages.includes('getting-started'));
    assert.ok(result.pages.includes('scanner'));
    assert.ok(result.pages.includes('handoff'));
    assert.ok(result.pages.includes('architecture'));
    assert.ok(result.pages.includes('api'));
    assert.equal(result.pages.length, result.searchIndexCount);

    const docsCssStat = await stat(path.join(result.outputDir, 'docs.css'));
    const docsJsStat = await stat(path.join(result.outputDir, 'docs.js'));
    assert.ok(docsCssStat.size > 0);
    assert.ok(docsJsStat.size > 0);

    // Verify live <copio-scanner> embed & SDK script on index.html and scanner.html
    const indexHtml = await readFile(path.join(result.outputDir, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('<copio-scanner'));
    assert.ok(indexHtml.includes("import { setAssetBase } from '/dist/index.js'"));
    assert.ok(indexHtml.includes('id="docs-search-input"'));

    const scannerHtml = await readFile(path.join(result.outputDir, 'scanner.html'), 'utf8');
    assert.ok(scannerHtml.includes('<copio-scanner'));
    assert.ok(scannerHtml.includes('data-scanner-attr="mode"'));

    const handoffHtml = await readFile(path.join(result.outputDir, 'handoff.html'), 'utf8');
    assert.ok(handoffHtml.includes('<copio-handoff'));
    assert.ok(handoffHtml.includes('transport="peer"'));
    assert.ok(handoffHtml.includes('receiver-url'));
    assert.ok(handoffHtml.includes('/docs/scan.html'));

    const scanHtml = await readFile(path.join(result.outputDir, 'scan.html'), 'utf8');
    assert.ok(scanHtml.includes('<copio-scanner'));
    assert.ok(scanHtml.includes("setAttribute('handoff'"));

    // Verify no broken internal /docs/<slug>/ links and directory index.html files exist
    for (const slug of result.pages) {
      const htmlPath =
        slug === 'index'
          ? path.join(result.outputDir, 'index.html')
          : path.join(result.outputDir, slug, 'index.html');
      const html = await readFile(htmlPath, 'utf8');
      assert.ok(!html.includes('/dist/docs/'), `Unexpected /dist/docs/ link in ${slug}`);
      const links = [...html.matchAll(/href="\/docs\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
      for (const target of links) {
        assert.ok(
          result.pages.includes(target),
          `Broken internal link /docs/${target}/ in ${slug}`,
        );
      }
    }

    // Verify search index & client search matching
    const indexRaw = await readFile(path.join(result.outputDir, 'search-index.json'), 'utf8');
    const searchIndex = JSON.parse(indexRaw);
    assert.equal(searchIndex.length, result.pages.length);

    const scannerHits = searchEntries(searchIndex, 'scanner');
    assert.ok(scannerHits.length > 0);
    assert.equal(scannerHits[0].entry.slug, 'scanner');

    const handoffHits = searchEntries(searchIndex, 'webrtc handoff');
    assert.ok(handoffHits.some((h) => h.entry.slug === 'handoff'));

    const storageHits = searchEntries(searchIndex, 'OpfsStorageAdapter');
    assert.ok(storageHits.some((h) => h.entry.slug === 'architecture' || h.entry.slug === 'api'));

    const emptyHits = searchEntries(searchIndex, 'zzzznonexistenttoken');
    assert.equal(emptyHits.length, 0);
  });

  it('CPO-082: generates CEM-backed API reference and hand-written guides without internal symbols or TODOs', async () => {
    const result = await buildDocs();
    const expectedGuides = [
      'storage-adapters',
      'theming',
      'licensing',
      'framework-integration',
      'offline-service-worker',
    ];
    for (const slug of expectedGuides) {
      assert.ok(result.pages.includes(slug), `Missing guide page: ${slug}`);
    }

    const apiHtml = await readFile(path.join(result.outputDir, 'api.html'), 'utf8');
    // CEM-driven sections for <copio-scanner>, <copio-handoff>, and CopioEngine
    assert.ok(apiHtml.includes('copio:page-added'));
    assert.ok(apiHtml.includes('--copio-color-primary'));
    assert.ok(apiHtml.includes('::part(scanner-root)'));
    assert.ok(apiHtml.includes('docs-badge-experimental'));
    assert.ok(apiHtml.includes('CopioEngine'));
    assert.ok(apiHtml.includes('MigrationRunner'));

    // Internal symbols must NOT be documented in API Reference
    for (const internalSymbol of ['LicenseManager', 'BUILD_DATE', 'CopioSyncDialog', 'CopioDocOcrDialog']) {
      assert.ok(!apiHtml.includes(internalSymbol), `Internal symbol leaked into api.html: ${internalSymbol}`);
    }

    // No TODO entries anywhere in built pages
    for (const slug of result.pages) {
      const htmlPath =
        slug === 'index'
          ? path.join(result.outputDir, 'index.html')
          : path.join(result.outputDir, slug, 'index.html');
      const html = await readFile(htmlPath, 'utf8');
      assert.ok(!/\bTODO\b/i.test(html), `Found TODO entry in ${slug}`);
    }

    const indexRaw = await readFile(path.join(result.outputDir, 'search-index.json'), 'utf8');
    const searchIndex = JSON.parse(indexRaw);
    assert.ok(searchEntries(searchIndex, 'MigrationRunner').some((h) => h.entry.slug === 'storage-adapters'));
    assert.ok(searchEntries(searchIndex, 'adoptedStyleSheets').some((h) => h.entry.slug === 'theming'));
  });

  it('CPO-081: getting-started guide covers install, first scan, and PDF export end-to-end', async () => {
    const result = await buildDocs();
    const gsHtml = await readFile(path.join(result.outputDir, 'getting-started.html'), 'utf8');

    assert.ok(gsHtml.includes('npm</span> install @copio/sdk'));
    assert.ok(gsHtml.includes('unpkg.com/@copio/sdk/dist/cdn.js'));
    assert.ok(gsHtml.includes('setAssetBase'));
    assert.ok(gsHtml.includes('<copio-scanner'));
    assert.ok(gsHtml.includes('SCAN_COMPLETE'));
    assert.ok(gsHtml.includes('exportPdf'));
    assert.ok(gsHtml.includes('URL.createObjectURL'));
  });
});
