#!/usr/bin/env node

/**
 * Copio SDK API Reference Generator (CPO-082)
 *
 * Reads dist/custom-elements.json (Custom Elements Manifest) and ADR 0004's
 * Public / Advanced export surface to generate structured HTML API tables
 * for <copio-scanner>, <copio-handoff>, CopioEngine, and package entry points.
 *
 * Strictly excludes internal symbols (LicenseManager, BUILD_DATE, app-only dialogs,
 * and unexported internal utilities) per CPO-067 / CPO-082.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultCemPath = path.join(rootDir, 'dist', 'custom-elements.json');

/**
 * Curated export surface classified per ADR 0004 (CPO-067).
 * Only Public and Advanced symbols are documented.
 */
export const CURATED_PUBLIC_EXPORTS = [
  // Public Tier (19 symbols on root '.')
  { symbol: 'CopioScanner', tier: 'public', kind: 'Web Component', entry: '@copio/sdk, @copio/sdk/scanner', summary: 'Embeddable <copio-scanner> two-stage document scanner element.' },
  { symbol: 'CopioHandoff', tier: 'public', kind: 'Web Component', entry: '@copio/sdk, @copio/sdk/handoff', experimental: true, summary: 'Desktop <copio-handoff> QR-to-WebRTC E2EE phone handoff widget.' },
  { symbol: 'CopioEngine', tier: 'public', kind: 'Class', entry: '@copio/sdk, @copio/sdk/core', summary: 'Headless document, capture, editing, OCR, and export engine.' },
  { symbol: 'COPIO_EVENTS', tier: 'public', kind: 'Constant', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/scanner, @copio/sdk/handoff', summary: 'Map of public copio:* CustomEvent names.' },
  { symbol: 'VERSION', tier: 'public', kind: 'Constant', entry: '@copio/sdk, @copio/sdk/core', summary: 'Published @copio/sdk semantic version string.' },
  { symbol: 'Document', tier: 'public', kind: 'Class', entry: '@copio/sdk, @copio/sdk/core', summary: 'Domain document model containing ordered Page entities.' },
  { symbol: 'Page', tier: 'public', kind: 'Class', entry: '@copio/sdk, @copio/sdk/core', summary: 'Domain page model with non-destructive edit stack and blobs.' },
  { symbol: 'ScanSession', tier: 'public', kind: 'Class', entry: '@copio/sdk, @copio/sdk/core', summary: 'Active capture session model tracking captured pages.' },
  { symbol: 'setAssetBase', tier: 'public', kind: 'Function', entry: '@copio/sdk', summary: 'Configure base URL for lazy WASM, worker, and vendor assets.' },
  { symbol: 'getAssetBase', tier: 'public', kind: 'Function', entry: '@copio/sdk', summary: 'Read the currently configured lazy asset base URL.' },
  { symbol: 'recognizeImageText', tier: 'public', kind: 'Function', entry: '@copio/sdk', summary: 'Headless single-image OCR helper returning text and confidence.' },
  { symbol: 'recognizeDocumentPages', tier: 'public', kind: 'Function', entry: '@copio/sdk', summary: 'Headless multi-page OCR helper across a Document.' },
  { symbol: 'exportDocumentAsPdf', tier: 'public', kind: 'Function', entry: '@copio/sdk', summary: 'Headless standard or searchable PDF exporter.' },
  { symbol: 'exportDocumentAsImages', tier: 'public', kind: 'Function', entry: '@copio/sdk', summary: 'Headless ZIP / PNG / JPEG image exporter.' },
  { symbol: 'StoragePort', tier: 'public', kind: 'Port', entry: '@copio/sdk, @copio/sdk/core', summary: 'Pluggable persistence interface for documents, blobs, and schema version.' },
  { symbol: 'MemoryStorageAdapter', tier: 'public', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'Ephemeral in-memory StoragePort implementation.' },
  { symbol: 'IndexedDbStorageAdapter', tier: 'public', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'IndexedDB-backed StoragePort implementation.' },
  { symbol: 'OpfsStorageAdapter', tier: 'public', kind: 'Adapter', entry: '@copio/sdk', summary: 'Origin Private File System StoragePort with IndexedDB fallback.' },
  { symbol: 'createDefaultAdapter', tier: 'public', kind: 'Function', entry: '@copio/sdk, @copio/sdk/core', summary: 'Auto-selects OPFS with IndexedDB fallback when available.' },

  // Advanced Tier (21 symbols on root '.' + subpath advanced helpers)
  { symbol: 'OcrPort', tier: 'advanced', kind: 'Port', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'Pluggable optical character recognition port.' },
  { symbol: 'TesseractWasmAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'Client-side Tesseract.js WASM OCR adapter.' },
  { symbol: 'NullOcrAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'No-op OcrPort fallback.' },
  { symbol: 'PdfPort', tier: 'advanced', kind: 'Port', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'Pluggable PDF compilation port.' },
  { symbol: 'PdfKitAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'Client-side PDFKit compiler with searchable text layer support.' },
  { symbol: 'NullPdfAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'No-op PdfPort fallback.' },
  { symbol: 'ImageProcessorPort', tier: 'advanced', kind: 'Port', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'Pluggable image transform port (crop, rotate, threshold, warp).' },
  { symbol: 'Canvas2DAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'Browser Canvas 2D ImageProcessorPort implementation.' },
  { symbol: 'NullImageProcessorAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'No-op ImageProcessorPort fallback.' },
  { symbol: 'SyncPort', tier: 'advanced', kind: 'Port', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'Pluggable P2P document synchronization port.' },
  { symbol: 'PeerJsAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'WebRTC DataChannel SyncPort via PeerJS.' },
  { symbol: 'NullSyncAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/adapters/*', summary: 'No-op SyncPort fallback.' },
  { symbol: 'EdgeDetectorPort', tier: 'advanced', kind: 'Port', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'Pluggable document quadrilateral edge detector port.' },
  { symbol: 'ScanicWasmEdgeAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/adapters/*', experimental: true, summary: 'Lightweight WASM/worker document edge detector adapter.' },
  { symbol: 'NullEdgeDetectorAdapter', tier: 'advanced', kind: 'Adapter', entry: '@copio/sdk, @copio/sdk/core, @copio/sdk/adapters/*', summary: 'No-op EdgeDetectorPort fallback.' },
  { symbol: 'HandoffSession', tier: 'advanced', kind: 'Class', entry: '@copio/sdk, @copio/sdk/handoff', experimental: true, summary: 'Headless E2EE ECDH/AES-GCM handoff session state machine.' },
  { symbol: 'LoopbackTransport', tier: 'advanced', kind: 'Class', entry: '@copio/sdk, @copio/sdk/handoff', experimental: true, summary: 'In-memory handoff transport for tests and same-tab demos.' },
  { symbol: 'MigrationRunner', tier: 'advanced', kind: 'Class', entry: '@copio/sdk, @copio/sdk/core', summary: 'Ordered schema migration runner for StoragePort instances.' },
  { symbol: 'CURRENT_SCHEMA_VERSION', tier: 'advanced', kind: 'Constant', entry: '@copio/sdk, @copio/sdk/core', summary: 'Current stored document schema version (3).' },
  { symbol: 'registerService', tier: 'advanced', kind: 'Function', entry: '@copio/sdk, @copio/sdk/core', summary: 'Register a driven adapter implementation for CopioEngine.' },
  { symbol: 'getRegisteredService', tier: 'advanced', kind: 'Function', entry: '@copio/sdk, @copio/sdk/core', summary: 'Retrieve a registered driven adapter by service name.' },
  { symbol: 'SyncManager', tier: 'advanced', kind: 'Class', entry: '@copio/sdk/sync', summary: 'P2P document sync coordinator over WebRTC.' },
  { symbol: 'getIceServers', tier: 'advanced', kind: 'Function', entry: '@copio/sdk/sync', summary: 'Resolve STUN/TURN ICE server configuration.' },
  { symbol: 'adoptScannerStyles', tier: 'advanced', kind: 'Function', entry: '@copio/sdk/scanner', summary: 'Adopt <copio-scanner> constructable stylesheet into a ShadowRoot.' },
  { symbol: 'adoptHandoffStyles', tier: 'advanced', kind: 'Function', entry: '@copio/sdk/handoff', summary: 'Adopt <copio-handoff> constructable stylesheet into a ShadowRoot.' },
];

const LIFECYCLE_METHODS = new Set([
  'connectedCallback',
  'disconnectedCallback',
  'attributeChangedCallback',
  'adoptedCallback',
]);

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBadges({ tier, experimental } = {}) {
  const parts = [];
  if (tier === 'public') {
    parts.push('<span class="docs-badge docs-badge-public">public</span>');
  } else if (tier === 'advanced') {
    parts.push('<span class="docs-badge docs-badge-advanced">advanced</span>');
  }
  if (experimental) {
    parts.push('<span class="docs-badge docs-badge-experimental">@experimental</span>');
  }
  return parts.join(' ');
}

/**
 * Ensures dist/custom-elements.json exists, running cem analyze if missing.
 * @param {string} [cemPath]
 * @returns {Promise<Object>}
 */
export async function loadCustomElementsManifest(cemPath = defaultCemPath) {
  if (!existsSync(cemPath)) {
    execSync('npx cem analyze --globs "sdk/**/*.js" --litelement --outdir dist', {
      cwd: rootDir,
      stdio: 'pipe',
    });
  }
  const raw = await readFile(cemPath, 'utf8');
  return JSON.parse(raw);
}

function findDeclaration(cem, modulePath, name) {
  const mod = (cem.modules || []).find((m) => m.path === modulePath);
  if (!mod) return null;
  return (mod.declarations || []).find((d) => d.name === name || d.tagName === name) || null;
}

function isPublicMember(member) {
  if (!member || !member.name) return false;
  if (member.name.startsWith('#') || member.name.startsWith('_')) return false;
  if (member.privacy === 'private' || member.privacy === 'protected') return false;
  if (LIFECYCLE_METHODS.has(member.name)) return false;
  if (member.static && member.name === 'observedAttributes') return false;
  return true;
}

function renderTable(headers, rows) {
  if (!rows.length) {
    return '<p><em>None.</em></p>';
  }
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tbody = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table class="docs-api-table"><thead><tr>${th}</tr></thead><tbody>\n${tbody}\n</tbody></table>`;
}

export function renderPublicExportsSection() {
  const rows = CURATED_PUBLIC_EXPORTS.map((item) => [
    `<code>${escapeHtml(item.symbol)}</code> ${renderBadges({ tier: item.tier, experimental: item.experimental })}`,
    escapeHtml(item.kind),
    `<code>${escapeHtml(item.entry)}</code>`,
    escapeHtml(item.summary),
  ]);

  return renderTable(['Symbol', 'Kind', 'Entry Point(s)', 'Description'], rows);
}

function formatParams(params = []) {
  return params
    .map((p) => {
      const opt = p.optional ? '?' : '';
      const type = p.type?.text ? `: ${p.type.text}` : '';
      return `${p.name}${opt}${type}`;
    })
    .join(', ');
}

function renderElementSection(decl, { experimental = false } = {}) {
  if (!decl) {
    return '<p><em>Element declaration not found in Custom Elements Manifest.</em></p>';
  }

  const parts = [];
  if (experimental) {
    parts.push(
      '<p><span class="docs-badge docs-badge-experimental">@experimental</span> This component is stabilizing ahead of v1.0.</p>',
    );
  }

  // Attributes
  const attrs = (decl.attributes || []).filter((a) => a.name && !a.name.startsWith('_'));
  if (attrs.length) {
    parts.push('<h3>Attributes</h3>');
    parts.push(
      renderTable(
        ['Attribute', 'Property', 'Type', 'Default', 'Description'],
        attrs.map((a) => [
          `<code>${escapeHtml(a.name)}</code>`,
          a.fieldName ? `<code>${escapeHtml(a.fieldName)}</code>` : '—',
          a.type?.text ? `<code>${escapeHtml(a.type.text)}</code>` : '<code>string</code>',
          a.default ? `<code>${escapeHtml(a.default)}</code>` : '—',
          escapeHtml(a.description || '—'),
        ]),
      ),
    );
  }

  // Properties (fields)
  const fields = (decl.members || []).filter((m) => m.kind === 'field' && isPublicMember(m));
  if (fields.length) {
    parts.push('<h3>Properties</h3>');
    parts.push(
      renderTable(
        ['Property', 'Type', 'Default', 'Description'],
        fields.map((f) => [
          `<code>${escapeHtml(f.name)}</code>`,
          f.type?.text ? `<code>${escapeHtml(f.type.text)}</code>` : '<code>any</code>',
          f.default ? `<code>${escapeHtml(f.default)}</code>` : '—',
          escapeHtml(f.description || '—'),
        ]),
      ),
    );
  }

  // Methods
  const methods = (decl.members || []).filter((m) => m.kind === 'method' && isPublicMember(m));
  if (methods.length) {
    parts.push('<h3>Methods</h3>');
    parts.push(
      renderTable(
        ['Method', 'Returns', 'Description'],
        methods.map((m) => {
          const sig = `${m.name}(${formatParams(m.parameters)})`;
          const ret = m.return?.type?.text || 'void';
          return [
            `<code>${escapeHtml(sig)}</code>`,
            `<code>${escapeHtml(ret)}</code>`,
            escapeHtml(m.description || '—'),
          ];
        }),
      ),
    );
  }

  // Events
  const events = decl.events || [];
  if (events.length) {
    parts.push('<h3>Events</h3>');
    parts.push(
      renderTable(
        ['Event', 'Detail Type', 'Description'],
        events.map((e) => [
          `<code>${escapeHtml(e.name)}</code>`,
          e.type?.text ? `<code>${escapeHtml(e.type.text)}</code>` : '<code>CustomEvent</code>',
          escapeHtml(e.description || '—'),
        ]),
      ),
    );
  }

  // CSS Custom Properties
  const cssProps = decl.cssProperties || [];
  if (cssProps.length) {
    parts.push('<h3>CSS Custom Properties</h3>');
    parts.push(
      renderTable(
        ['Property', 'Default', 'Description'],
        cssProps.map((p) => [
          `<code>${escapeHtml(p.name)}</code>`,
          p.default ? `<code>${escapeHtml(p.default)}</code>` : '—',
          escapeHtml(p.description || '—'),
        ]),
      ),
    );
  }

  // CSS Parts
  const cssParts = decl.cssParts || [];
  if (cssParts.length) {
    parts.push('<h3>CSS Shadow Parts</h3>');
    parts.push(
      renderTable(
        ['Part', 'Description'],
        cssParts.map((p) => [
          `<code>::part(${escapeHtml(p.name)})</code>`,
          escapeHtml(p.description || '—'),
        ]),
      ),
    );
  }

  return parts.join('\n');
}

function renderEngineSection(decl) {
  if (!decl) {
    return '<p><em>CopioEngine declaration not found in Custom Elements Manifest.</em></p>';
  }

  const parts = [];
  const fields = (decl.members || []).filter((m) => m.kind === 'field' && isPublicMember(m));
  if (fields.length) {
    parts.push('<h3>Properties</h3>');
    parts.push(
      renderTable(
        ['Property', 'Type', 'Description'],
        fields.map((f) => [
          `<code>${escapeHtml(f.name)}</code>`,
          f.type?.text ? `<code>${escapeHtml(f.type.text)}</code>` : '<code>any</code>',
          escapeHtml(f.description || '—'),
        ]),
      ),
    );
  }

  const methods = (decl.members || []).filter((m) => m.kind === 'method' && isPublicMember(m));
  if (methods.length) {
    parts.push('<h3>Methods</h3>');
    parts.push(
      renderTable(
        ['Method', 'Returns', 'Description'],
        methods.map((m) => {
          const sig = `${m.name}(${formatParams(m.parameters)})`;
          const ret = m.return?.type?.text || 'void';
          return [
            `<code>${escapeHtml(sig)}</code>`,
            `<code>${escapeHtml(ret)}</code>`,
            escapeHtml(m.description || '—'),
          ];
        }),
      ),
    );
  }

  return parts.join('\n');
}

/**
 * Generates all CEM-backed API reference sections keyed by marker name.
 * @param {string} [cemPath]
 * @returns {Promise<Record<string, string>>}
 */
export async function generateApiSections(cemPath = defaultCemPath) {
  const cem = await loadCustomElementsManifest(cemPath);
  const scannerDecl = findDeclaration(cem, 'sdk/scanner.js', 'CopioScanner');
  const handoffDecl = findDeclaration(cem, 'sdk/handoff.js', 'CopioHandoff');
  const engineDecl = findDeclaration(cem, 'sdk/core.js', 'CopioEngine');

  return {
    PUBLIC_EXPORTS: renderPublicExportsSection(),
    'copio-scanner': renderElementSection(scannerDecl, { experimental: false }),
    'copio-handoff': renderElementSection(handoffDecl, { experimental: true }),
    'copio-engine': renderEngineSection(engineDecl),
  };
}

/**
 * Replaces <!-- CEM:KEY --> markers in rendered HTML or markdown with generated sections.
 * @param {string} content
 * @param {Record<string, string>} sections
 * @returns {string}
 */
export function expandCemMarkers(content, sections) {
  return String(content).replace(/<!--\s*CEM:([A-Za-z0-9_-]+)\s*-->/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(sections, key) ? sections[key] : match;
  });
}
