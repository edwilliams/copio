import { expect } from '@esm-bundle/chai';
import * as SDK from '../sdk/index.js';
import * as Core from '../sdk/core.js';
import * as Scanner from '../sdk/scanner.js';
import * as Sync from '../sdk/sync.js';
import { LicenseManager } from '../sdk/license.js';
import { BUILD_DATE, VERSION } from '../sdk/version.js';

describe('CPO-060 & CPO-061: SDK Packaging & Exports', () => {
  it('exports CopioScanner and LicenseManager named exports from SDK root', () => {
    expect(SDK.CopioScanner).to.be.a('function');
    expect(SDK.LicenseManager).to.be.a('function');
    expect(SDK.CopioEngine).to.be.a('function');
    expect(SDK.MemoryStorageAdapter).to.be.a('function');
    expect(SDK.BUILD_DATE).to.be.a('string');
    expect(SDK.VERSION).to.equal('0.1.0');
  });

  it('exports headless domain and storage adapters from @copio/sdk/core', async () => {
    expect(Core.CopioEngine).to.be.a('function');
    expect(Core.MemoryStorageAdapter).to.be.a('function');
    expect(Core.DocRepository).to.be.a('function');
    expect(Core.createDefaultAdapter).to.be.a('function');

    // Test CopioEngine lifecycle with MemoryStorageAdapter
    const memoryAdapter = new Core.MemoryStorageAdapter();
    const engine = new Core.CopioEngine({ storage: memoryAdapter });
    await engine.init();

    const created = await engine.createDocument('Contract Scan', [
      { id: 'p1', src: 'data:image/png;base64,abc' },
    ]);
    expect(created.id).to.be.a('string');
    expect(created.name).to.equal('Contract Scan');

    const list = await engine.listDocuments();
    expect(list.length).to.equal(1);
    expect(list[0].id).to.equal(created.id);

    await engine.renameDocument(created.id, 'Renamed Contract');
    const updated = await engine.getDocument(created.id);
    expect(updated.name).to.equal('Renamed Contract');

    await engine.deleteDocument(created.id);
    const afterDelete = await engine.listDocuments();
    expect(afterDelete.length).to.equal(0);
  });

  it('provides LicenseManager with tier resolution', () => {
    const defaultManager = new LicenseManager();
    expect(defaultManager.isValid()).to.be.false;
    expect(defaultManager.getTier()).to.equal('community');

    const proManager = new LicenseManager('pro_test_12345');
    expect(proManager.isValid()).to.be.true;
    expect(proManager.getTier()).to.equal('pro');

    const enterpriseManager = new LicenseManager('ent_enterprise_key');
    expect(enterpriseManager.isValid()).to.be.true;
    expect(enterpriseManager.getTier()).to.equal('enterprise');
  });

  it('defines <copio-scanner> custom element and mounts cleanly', () => {
    expect(customElements.get('copio-scanner')).to.exist;

    const el = document.createElement('copio-scanner');
    el.setAttribute('mode', 'single');
    document.body.appendChild(el);

    expect(el.mode).to.equal('single');
    expect(el.shadowRoot).to.exist;
    expect(el.shadowRoot.querySelector('.copio-scanner-container')).to.exist;

    el.remove();
  });

  it('exports CopioScanner from @copio/sdk/scanner', () => {
    expect(Scanner.CopioScanner).to.be.a('function');
  });

  it('exports sync manager and dialog from @copio/sdk/sync', () => {
    expect(Sync.SyncManager).to.be.a('function');
    expect(Sync.CopioSyncDialog).to.be.a('function');
    expect(Sync.getIceServers).to.be.a('function');
  });

  it('injects build date and version', () => {
    expect(BUILD_DATE).to.be.a('string');
    expect(new Date(BUILD_DATE).getTime()).to.be.greaterThan(0);
    expect(VERSION).to.equal('0.1.0');
  });

  it('defines package.json types and customElements manifest entries (CPO-063)', async () => {
    const pkg = await fetch('/package.json').then((r) => r.json());
    expect(pkg.types).to.equal('./dist/types/sdk/index.d.ts');
    expect(pkg.customElements).to.equal('dist/custom-elements.json');
    expect(pkg.exports['.'].types).to.equal('./dist/types/sdk/index.d.ts');
    expect(pkg.exports['./core'].types).to.equal('./dist/types/sdk/core.d.ts');
    expect(pkg.exports['./scanner'].types).to.equal('./dist/types/sdk/scanner.d.ts');
    expect(pkg.exports['./sync'].types).to.equal('./dist/types/sdk/sync.d.ts');
  });
});
