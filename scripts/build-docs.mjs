#!/usr/bin/env node

/**
 * Copio SDK Docs Site Builder (CPO-080)
 *
 * Zero-dependency static documentation generator:
 * - Parses Markdown pages in docs-site/pages/*.md
 * - Builds semantic HTML into dist/docs/ alongside the SDK build
 * - Generates dist/docs/search-index.json for instant client-side search
 * - Supports live <copio-scanner> and <copio-handoff> Web Component embeds
 */

import { mkdir, readdir, readFile, rm, writeFile, cp } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { expandCemMarkers, generateApiSections } from './generate-api-docs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultSourceDir = path.join(rootDir, 'docs-site');
const defaultOutputDir = path.join(rootDir, 'dist', 'docs');

const SECTION_ORDER = ['Overview', 'Components', 'Architecture', 'Guides', 'Reference'];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function highlightCode(code, lang) {
  const normalized = String(lang || 'text').toLowerCase();

  const highlightByRegex = (source, regex, classify) => {
    let out = '';
    let lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const idx = match.index ?? 0;
      if (idx > lastIndex) {
        out += escapeHtml(source.slice(lastIndex, idx));
      }
      const token = match[0];
      const cls = classify(match);
      out += cls ? `<span class="${cls}">${escapeHtml(token)}</span>` : escapeHtml(token);
      lastIndex = idx + token.length;
    }
    if (lastIndex < source.length) {
      out += escapeHtml(source.slice(lastIndex));
    }
    return out;
  };

  if (['js', 'javascript', 'ts', 'typescript'].includes(normalized)) {
    const jsRegex =
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`])*`|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*')|\b(import|from|export|default|const|let|var|function|return|async|await|new|class|extends|if|else|for|of|in|true|false|null|undefined|type|interface)\b|\b(\d+(?:\.\d+)?)\b|\b([a-zA-Z_$][\w$]*)(?=\s*\()/g;
    return highlightByRegex(code, jsRegex, (m) => {
      if (m[1]) return 'tok-comment';
      if (m[2]) return 'tok-string';
      if (m[3]) return 'tok-keyword';
      if (m[4]) return 'tok-number';
      if (m[5]) return 'tok-function';
      return '';
    });
  }

  if (['html', 'xml', 'svg'].includes(normalized)) {
    const htmlRegex =
      /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z0-9-]+|\s*\/?>)|("(?:[^"]*)"|'(?:[^']*)')|([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?==)/g;
    return highlightByRegex(code, htmlRegex, (m) => {
      if (m[1]) return 'tok-comment';
      if (m[2]) return 'tok-tag';
      if (m[3]) return 'tok-string';
      if (m[4]) return 'tok-attr';
      return '';
    });
  }

  if (normalized === 'css') {
    const cssRegex =
      /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*')|(--[a-zA-Z0-9-]+)|([a-zA-Z-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|ms|s)?\b)/g;
    return highlightByRegex(code, cssRegex, (m) => {
      if (m[1]) return 'tok-comment';
      if (m[2]) return 'tok-string';
      if (m[3]) return 'tok-attr';
      if (m[4]) return 'tok-keyword';
      if (m[5]) return 'tok-number';
      return '';
    });
  }

  if (['bash', 'sh', 'shell', 'zsh'].includes(normalized)) {
    const bashRegex =
      /(#[^\n]*)|("(?:\\.|[^"])*"|'(?:[^']*)')|\b(npm|npx|node|git|gh|curl|pnpm|yarn|bun)\b|(\s--?[a-zA-Z0-9-]+)/g;
    return highlightByRegex(code, bashRegex, (m) => {
      if (m[1]) return 'tok-comment';
      if (m[2]) return 'tok-string';
      if (m[3]) return 'tok-keyword';
      if (m[4]) return 'tok-attr';
      return '';
    });
  }

  if (normalized === 'json') {
    const jsonRegex = /("(?:\\.|[^"])*")(?=\s*:)|("(?:\\.|[^"])*")|\b(true|false|null)\b|\b(-?\d+(?:\.\d+)?)\b/g;
    return highlightByRegex(code, jsonRegex, (m) => {
      if (m[1]) return 'tok-attr';
      if (m[2]) return 'tok-string';
      if (m[3]) return 'tok-keyword';
      if (m[4]) return 'tok-number';
      return '';
    });
  }

  return escapeHtml(code);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^\d+$/.test(val)) val = Number(val);
    meta[key] = val;
  }
  return { meta, body: match[2] };
}

function renderInline(text) {
  const codeSpans = [];
  let out = String(text).replace(/`([^`]+)`/g, (_m, code) => {
    const token = `@@COPIOCODE${codeSpans.length}@@`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  out = escapeHtml(out);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = href.replace(/"/g, '&quot;');
    const isExternal = /^https?:\/\//.test(href);
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safeHref}"${attrs}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  out = out.replace(/@@COPIOCODE(\d+)@@/g, (_m, idx) => codeSpans[Number(idx)]);
  return out;
}

export function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  const headings = [];
  const usedIds = new Map();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code block
    const fenceMatch = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || 'text';
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      const codeText = codeLines.join('\n');
      html.push(
        `<div class="docs-code-block">` +
          `<div class="docs-code-header">` +
            `<span class="docs-code-lang">${escapeHtml(lang)}</span>` +
            `<button type="button" class="docs-copy-btn" data-copy-code>Copy</button>` +
          `</div>` +
          `<pre><code class="language-${escapeHtml(lang)}">${highlightCode(codeText, lang)}</code></pre>` +
        `</div>`,
      );
      continue;
    }

    // Raw HTML block (for live <copio-scanner> / <copio-handoff> embeds)
    if (line.trim().startsWith('<')) {
      const htmlLines = [line];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '') {
        htmlLines.push(lines[i]);
        i += 1;
      }
      html.push(htmlLines.join('\n'));
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawText = headingMatch[2].trim();
      let id = slugify(rawText) || 'section';
      const count = usedIds.get(id) || 0;
      usedIds.set(id, count + 1);
      if (count > 0) id = `${id}-${count}`;

      const plainText = rawText.replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      if (level >= 2 && level <= 3) {
        headings.push({ level, id, text: plainText });
      }
      html.push(
        `<h${level} id="${id}">${renderInline(rawText)}` +
          `<a class="docs-anchor" href="#${id}" aria-label="Link to ${escapeHtml(plainText)}">#</a>` +
        `</h${level}>`,
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      html.push('<hr />');
      i += 1;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote><p>${renderInline(quoteLines.join(' '))}</p></blockquote>`);
      continue;
    }

    // Markdown table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
      const parseRow = (rowLine) =>
        rowLine
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());

      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      html.push(`<div class="docs-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`);
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,4}\s+/) &&
      !lines[i].match(/^```/) &&
      !lines[i].startsWith('>') &&
      !lines[i].trim().startsWith('<') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${renderInline(paraLines.join(' '))}</p>`);
    }
  }

  return { html: html.join('\n'), headings };
}

function stripMarkdownForSearch(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageHref(slug) {
  return slug === 'index' ? '/docs/' : `/docs/${slug}/`;
}

function buildSidebarHtml(pages, currentSlug) {
  const grouped = new Map();
  for (const sec of SECTION_ORDER) grouped.set(sec, []);
  for (const page of pages) {
    const sec = page.section || 'Overview';
    if (!grouped.has(sec)) grouped.set(sec, []);
    grouped.get(sec).push(page);
  }

  const sectionsHtml = [];
  for (const [section, items] of grouped.entries()) {
    if (items.length === 0) continue;
    const links = items
      .map((p) => {
        const active = p.slug === currentSlug ? ' class="active" aria-current="page"' : '';
        return `<li><a href="${pageHref(p.slug)}"${active}>${escapeHtml(p.title)}</a></li>`;
      })
      .join('');
    sectionsHtml.push(
      `<div class="docs-nav-group">` +
        `<div class="docs-nav-heading">${escapeHtml(section)}</div>` +
        `<ul class="docs-nav-list">${links}</ul>` +
      `</div>`,
    );
  }
  return sectionsHtml.join('');
}

function buildTocHtml(headings) {
  if (!headings.length) return '';
  const items = headings
    .map(
      (h) =>
        `<li class="toc-level-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`,
    )
    .join('');
  return (
    `<aside class="docs-toc" aria-label="On this page">` +
      `<div class="docs-toc-title">On this page</div>` +
      `<ul>${items}</ul>` +
    `</aside>`
  );
}

function buildPageHtml({ page, pages, version }) {
  const idx = pages.findIndex((p) => p.slug === page.slug);
  const prev = idx > 0 ? pages[idx - 1] : null;
  const next = idx < pages.length - 1 ? pages[idx + 1] : null;

  const pagerHtml =
    prev || next
      ? `<nav class="docs-pager" aria-label="Pagination">` +
          (prev
            ? `<a class="docs-pager-link prev" href="${pageHref(prev.slug)}"><span class="docs-pager-label">Previous</span><span class="docs-pager-title">← ${escapeHtml(prev.title)}</span></a>`
            : '<span></span>') +
          (next
            ? `<a class="docs-pager-link next" href="${pageHref(next.slug)}"><span class="docs-pager-label">Next</span><span class="docs-pager-title">${escapeHtml(next.title)} →</span></a>`
            : '<span></span>') +
        `</nav>`
      : '';

  const sdkEmbedScript = page.embeds
    ? `<script type="module">
    import { setAssetBase } from '/dist/index.js';
    setAssetBase('/dist/');
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>if (location.pathname === '/docs') location.replace('/docs/' + location.search + location.hash);</script>
  <title>${escapeHtml(page.title)} — Copio SDK Docs</title>
  <meta name="description" content="${escapeHtml(page.description || 'Copio SDK documentation')}" />
  <link rel="icon" type="image/svg+xml" href="/copio.svg" />
  <link rel="stylesheet" href="/docs/docs.css" />
</head>
<body>
  <header class="docs-header">
    <div class="docs-header-left">
      <button type="button" class="docs-menu-btn" id="docs-menu-btn" aria-label="Toggle navigation" aria-expanded="false">☰</button>
      <a class="docs-brand" href="/docs/">
        <span class="docs-brand-logo">C</span>
        <span class="docs-brand-name">Copio Docs</span>
      </a>
      <span class="docs-version-badge">v${escapeHtml(version)}</span>
    </div>

    <div class="docs-search-wrap">
      <div class="docs-search-box">
        <input
          type="search"
          id="docs-search-input"
          class="docs-search-input"
          placeholder="Search docs… ( / or Ctrl+K )"
          aria-label="Search documentation"
          autocomplete="off"
        />
        <kbd class="docs-search-kbd">/</kbd>
      </div>
      <div id="docs-search-results" class="docs-search-results" role="listbox" hidden></div>
    </div>

    <div class="docs-header-right">
      <button type="button" id="docs-theme-toggle" class="docs-icon-btn" aria-label="Toggle color theme" title="Toggle theme">◐</button>
      <a class="docs-sandbox-link" href="/">Live Sandbox ↗</a>
    </div>
  </header>

  <div class="docs-shell">
    <aside class="docs-sidebar" id="docs-sidebar" aria-label="Documentation navigation">
      ${buildSidebarHtml(pages, page.slug)}
    </aside>

    <main class="docs-main">
      <article class="docs-content">
        <div class="docs-section-eyebrow">${escapeHtml(page.section || 'Docs')}</div>
        ${page.html}
        ${pagerHtml}
      </article>
      ${buildTocHtml(page.headings)}
    </main>
  </div>

  ${sdkEmbedScript}
  <script type="module" src="/docs/docs.js"></script>
</body>
</html>
`;
}

export async function buildDocs({
  sourceDir = defaultSourceDir,
  outputDir = defaultOutputDir,
} = {}) {
  const pkgRaw = await readFile(path.join(rootDir, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const version = pkg.version || '0.1.8';

  const pagesDir = path.join(sourceDir, 'pages');
  const assetsDir = path.join(sourceDir, 'assets');
  const entries = (await readdir(pagesDir)).filter((f) => f.endsWith('.md'));

  const apiSections = await generateApiSections();
  const parsedPages = [];
  for (const file of entries) {
    const raw = await readFile(path.join(pagesDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = meta.slug || file.replace(/\.md$/, '');
    const { html: rawHtml, headings } = renderMarkdown(body);
    const html = expandCemMarkers(rawHtml, apiSections);
    const expandedText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    parsedPages.push({
      slug,
      title: meta.title || slug,
      description: meta.description || '',
      section: meta.section || 'Overview',
      order: typeof meta.order === 'number' ? meta.order : 99,
      embeds: Boolean(meta.embeds),
      html,
      headings,
      searchText: `${stripMarkdownForSearch(body)} ${expandedText}`.trim(),
    });
  }

  parsedPages.sort((a, b) => {
    const secA = SECTION_ORDER.indexOf(a.section);
    const secB = SECTION_ORDER.indexOf(b.section);
    const normA = secA === -1 ? 99 : secA;
    const normB = secB === -1 ? 99 : secB;
    if (normA !== normB) return normA - normB;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(assetsDir, outputDir, { recursive: true });

  const searchIndex = [];
  for (const page of parsedPages) {
    const fullHtml = buildPageHtml({ page, pages: parsedPages, version });
    if (page.slug === 'index') {
      await writeFile(path.join(outputDir, 'index.html'), fullHtml, 'utf8');
    } else {
      const slugDir = path.join(outputDir, page.slug);
      await mkdir(slugDir, { recursive: true });
      await writeFile(path.join(slugDir, 'index.html'), fullHtml, 'utf8');
      await writeFile(path.join(outputDir, `${page.slug}.html`), fullHtml, 'utf8');
    }
    searchIndex.push({
      slug: page.slug,
      href: pageHref(page.slug),
      title: page.title,
      section: page.section,
      description: page.description,
      headings: page.headings.map((h) => ({ id: h.id, text: h.text })),
      text: page.searchText,
    });
  }

  await writeFile(
    path.join(outputDir, 'search-index.json'),
    JSON.stringify(searchIndex, null, 2),
    'utf8',
  );

  return {
    pages: parsedPages.map((p) => p.slug),
    outputDir,
    searchIndexCount: searchIndex.length,
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  buildDocs()
    .then((res) => {
      console.log(
        `📚 Built Copio docs (${res.pages.length} pages, search index ready) -> ${path.relative(rootDir, res.outputDir)}`,
      );
    })
    .catch((err) => {
      console.error('❌ Docs build failed:', err);
      process.exit(1);
    });
}
