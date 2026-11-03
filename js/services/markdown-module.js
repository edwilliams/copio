/**
 * Copio Markdown Notes Module (CPO-026)
 * 
 * Isolates all Markdown page creation, parsing, HTML rendering,
 * and PDF compilation behind a single opt-in module boundary.
 * 
 * Allows complete exclusion/tree-shaking of `marked` in production
 * and SDK builds when note-taking features are not needed.
 */
import { randomId } from '../utils/utils.js';
import { loadMarked } from '../utils/module-loader.js';
import { notify } from './notify.js';

export const MARKDOWN_STORAGE_KEY = 'copio-markdown-enabled';

/**
 * Check whether markdown notes are enabled in application storage/config.
 * Defaults to true for the full Copio web application.
 * @returns {boolean}
 */
export function isMarkdownEnabled() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(MARKDOWN_STORAGE_KEY) !== 'false';
    }
  } catch {}
  return true;
}

/**
 * Toggle or set whether markdown notes are enabled.
 * Persists to localStorage and notifies listeners.
 * @param {boolean} enabled
 * @returns {boolean}
 */
export function setMarkdownEnabled(enabled) {
  const val = Boolean(enabled);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MARKDOWN_STORAGE_KEY, String(val));
    }
  } catch {}
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('copio:markdown-toggled', {
        detail: { enabled: val },
      }),
    );
  }
  return val;
}

/**
 * Check if a page object is a markdown page.
 * @param {any} page
 * @returns {boolean}
 */
export function isMarkdownPage(page) {
  return Boolean(page && page.type === 'markdown');
}

/**
 * Create a new markdown page object.
 * @param {Object} [options]
 * @param {string} [options.id]
 * @param {string} [options.name]
 * @param {string} [options.content]
 * @returns {{ id: string, type: 'markdown', name: string, content: string }}
 */
export function createMarkdownPage({ id, name, content } = {}) {
  return {
    id: id || randomId(),
    type: 'markdown',
    name: name || 'New Note',
    content: content || '',
  };
}

/**
 * Clean text from markdown formatting and emojis for PDF kit rendering.
 * @param {string} txt
 * @returns {string}
 */
export function cleanText(txt) {
  if (!txt) return '';
  return txt
    .replace(/✅/g, 'Yes')
    .replace(/❌/g, 'No')
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      '',
    )
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

/**
 * Lazy loads the marked parser on demand.
 * @returns {Promise<any>}
 */
export async function loadMarkdownParser() {
  return loadMarked();
}

/**
 * Render raw markdown string to HTML.
 * Lazily loads `marked` if not already loaded.
 * @param {string} rawContent
 * @returns {Promise<string>}
 */
export async function renderMarkdownToHtml(rawContent) {
  const marked = await loadMarkdownParser();
  if (marked && typeof marked.parse === 'function') {
    return marked.parse(rawContent || '');
  }
  return rawContent || '';
}

/**
 * Synchronous parse if `window.marked` is already available; fallback to raw text.
 * @param {string} rawContent
 * @returns {string}
 */
export function parseMarkdownSync(rawContent) {
  if (typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(rawContent || '');
  }
  return rawContent || '';
}

/**
 * Export markdown pages of a document as a .md file download.
 * @param {string} docName
 * @param {Array<Object>} pages
 */
export function exportDocumentAsMarkdown(docName, pages) {
  if (!pages) return;
  const mdPages = pages.filter(isMarkdownPage);

  if (mdPages.length === 0) {
    notify.warning('No markdown text in this document');
    return;
  }

  const safeName = (docName || 'document').trim().replace(/[/\\?%*:|"<>]/g, '_');

  let content = '';
  if (mdPages.length === 1) {
    content = mdPages[0].content || '';
  } else {
    content = mdPages
      .map((p, i) => `# Page ${i + 1}: ${p.name || ''}\n\n${p.content || ''}`)
      .join('\n\n---\n\n');
  }

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.md`;
  a.click();
  URL.revokeObjectURL(url);
  notify.success(`Exported "${safeName}.md"`);
}
