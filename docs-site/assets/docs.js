/**
 * Copio SDK Docs Client Script (CPO-080)
 * - Theme toggle (dark / light)
 * - Instant client-side search over search-index.json
 * - Code block copy buttons
 * - Mobile sidebar drawer toggle
 * - Live <copio-scanner> embed attribute controls
 */

export function scoreSearchResult(entry, tokens) {
  const titleLower = (entry.title || '').toLowerCase();
  const descLower = (entry.description || '').toLowerCase();
  const textLower = (entry.text || '').toLowerCase();
  const headings = Array.isArray(entry.headings) ? entry.headings : [];

  let score = 0;
  let matchedHeading = null;

  for (const token of tokens) {
    let tokenMatched = false;
    if (titleLower.includes(token)) {
      score += 12;
      tokenMatched = true;
    }
    for (const h of headings) {
      if ((h.text || '').toLowerCase().includes(token)) {
        score += 8;
        tokenMatched = true;
        if (!matchedHeading) matchedHeading = h;
      }
    }
    if (descLower.includes(token)) {
      score += 5;
      tokenMatched = true;
    }
    if (textLower.includes(token)) {
      score += 2;
      tokenMatched = true;
    }
    if (!tokenMatched) {
      return null;
    }
  }

  return { entry, score, matchedHeading };
}

export function searchEntries(index, query, limit = 8) {
  const tokens = String(query || '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const results = [];
  for (const entry of index) {
    const scored = scoreSearchResult(entry, tokens);
    if (scored) results.push(scored);
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSnippet(entry, query) {
  const text = entry.text || entry.description || '';
  if (!text) return '';
  const firstToken = query.toLowerCase().trim().split(/\s+/)[0] || '';
  const idx = firstToken ? text.toLowerCase().indexOf(firstToken) : -1;
  if (idx === -1) return text.slice(0, 110);
  const start = Math.max(0, idx - 32);
  const end = Math.min(text.length, idx + 84);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function initDocs() {
  if (typeof document === 'undefined') return;

  // 1. Theme toggle
  const htmlEl = document.documentElement;
  const savedTheme = (() => {
    try {
      return localStorage.getItem('copio-docs-theme');
    } catch {
      return null;
    }
  })();
  if (savedTheme === 'light' || savedTheme === 'dark') {
    htmlEl.setAttribute('data-theme', savedTheme);
  }

  const themeBtn = document.getElementById('docs-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = htmlEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      htmlEl.setAttribute('data-theme', next);
      try {
        localStorage.setItem('copio-docs-theme', next);
      } catch {
        // ignore storage errors
      }
    });
  }

  // 2. Mobile sidebar toggle
  const menuBtn = document.getElementById('docs-menu-btn');
  const sidebar = document.getElementById('docs-sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // 3. Copy code buttons
  document.querySelectorAll('[data-copy-code]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const block = btn.closest('.docs-code-block');
      const codeEl = block ? block.querySelector('pre code') : null;
      if (!codeEl) return;
      try {
        await navigator.clipboard.writeText(codeEl.textContent || '');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = orig || 'Copy';
        }, 1400);
      } catch {
        btn.textContent = 'Failed';
      }
    });
  });

  // 4. Live <copio-scanner> embed controls
  document.querySelectorAll('[data-embed-scanner]').forEach((card) => {
    const scanner = card.querySelector('copio-scanner');
    if (!scanner) return;
    card.querySelectorAll('[data-scanner-attr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.getAttribute('data-scanner-attr');
        const val = btn.getAttribute('data-scanner-val');
        if (!attr || !val) return;
        scanner.setAttribute(attr, val);
        card.querySelectorAll(`[data-scanner-attr="${attr}"]`).forEach((sibling) => {
          sibling.setAttribute('aria-pressed', String(sibling === btn));
        });
      });
    });
  });

  // 5. Search
  const searchInput = document.getElementById('docs-search-input');
  const resultsBox = document.getElementById('docs-search-results');
  if (!searchInput || !resultsBox) return;

  let cachedIndex = null;
  let activeIdx = -1;

  async function ensureIndex() {
    if (cachedIndex) return cachedIndex;
    const res = await fetch('/docs/search-index.json');
    if (!res.ok) throw new Error('Failed to load search index');
    cachedIndex = await res.json();
    return cachedIndex;
  }

  function renderResults(matches, query) {
    activeIdx = -1;
    if (!query.trim()) {
      resultsBox.hidden = true;
      resultsBox.innerHTML = '';
      return;
    }
    if (matches.length === 0) {
      resultsBox.hidden = false;
      resultsBox.innerHTML = `<div class="docs-search-empty">No results for "${escapeHtml(query)}"</div>`;
      return;
    }

    resultsBox.hidden = false;
    resultsBox.innerHTML = matches
      .map((m, i) => {
        const href = m.matchedHeading ? `${m.entry.href}#${m.matchedHeading.id}` : m.entry.href;
        const headingBadge = m.matchedHeading
          ? `<span class="docs-search-item-meta"># ${escapeHtml(m.matchedHeading.text)}</span>`
          : `<span class="docs-search-item-meta">${escapeHtml(m.entry.section)}</span>`;
        const snippet = buildSnippet(m.entry, query);
        return (
          `<a class="docs-search-item" href="${href}" role="option" data-result-idx="${i}" aria-selected="false">` +
            `<div class="docs-search-item-title">${escapeHtml(m.entry.title)}${headingBadge}</div>` +
            `<div class="docs-search-item-snippet">${escapeHtml(snippet)}</div>` +
          `</a>`
        );
      })
      .join('');
  }

  searchInput.addEventListener('focus', () => {
    ensureIndex().catch(() => {});
  });

  searchInput.addEventListener('input', async () => {
    const query = searchInput.value;
    if (!query.trim()) {
      renderResults([], '');
      return;
    }
    try {
      const index = await ensureIndex();
      const matches = searchEntries(index, query);
      renderResults(matches, query);
    } catch {
      resultsBox.hidden = false;
      resultsBox.innerHTML = '<div class="docs-search-empty">Search index unavailable.</div>';
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = Array.from(resultsBox.querySelectorAll('.docs-search-item'));
    if (e.key === 'Escape') {
      resultsBox.hidden = true;
      searchInput.blur();
      return;
    }
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + items.length) % items.length;
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      items[activeIdx].click();
      return;
    } else {
      return;
    }

    items.forEach((el, idx) => {
      el.setAttribute('aria-selected', String(idx === activeIdx));
    });
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
    if ((e.key === '/' && !isTyping) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  document.addEventListener('click', (e) => {
    if (!resultsBox.contains(e.target) && e.target !== searchInput) {
      resultsBox.hidden = true;
    }
  });
}

initDocs();
