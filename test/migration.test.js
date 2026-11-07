import { expect } from '@esm-bundle/chai';
import {
  MigrationRunner,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MIGRATIONS,
} from '../js/services/migration-runner.js';
import { StoragePort } from '../js/adapters/storage/storage-port.js';
import { MemoryStorageAdapter } from '../js/adapters/storage/memory-adapter.js';
import { IndexedDbStorageAdapter } from '../js/adapters/storage/indexeddb-adapter.js';
import { OpfsStorageAdapter } from '../js/adapters/storage/opfs-adapter.js';
import { CopioEngine } from '../sdk/core.js';
import { COPIO_EVENTS } from '../sdk/events.js';
import { DocRepository } from '../js/services/doc-repository.js';
import '../sdk/scanner.js';

describe('CPO-013: Data Migration Framework & Schema Versioning', () => {
  const adapterFactories = [
    {
      name: 'MemoryStorageAdapter',
      create: () => new MemoryStorageAdapter(),
    },
    {
      name: 'IndexedDbStorageAdapter',
      create: () => new IndexedDbStorageAdapter({ dbName: 'test-mig-idb-' + Date.now() + '-' + Math.random().toString(36).slice(2) }),
    },
    {
      name: 'OpfsStorageAdapter',
      create: () => new OpfsStorageAdapter({ dirName: 'test-mig-opfs-' + Date.now() + '-' + Math.random().toString(36).slice(2) }),
    },
  ];

  describe('StoragePort Schema Version Contract across all shipped adapters', () => {
    adapterFactories.forEach(({ name, create }) => {
      it(`${name} implements getSchemaVersion and setSchemaVersion correctly`, async () => {
        const adapter = create();
        await adapter.init();

        // Fresh adapter defaults to unversioned (null)
        expect(await adapter.getSchemaVersion()).to.be.null;

        // Persist schema version
        await adapter.setSchemaVersion(1);
        expect(await adapter.getSchemaVersion()).to.equal(1);

        // Update to higher schema version
        await adapter.setSchemaVersion(2);
        expect(await adapter.getSchemaVersion()).to.equal(2);
      });
    });

    it('custom StoragePort subclass defaults to in-memory schemaVersion tracking', async () => {
      class CustomStorageAdapter extends StoragePort {
        async init() {
          return { kind: 'custom', persistent: false };
        }
        async listDocs() {
          return [];
        }
      }

      const custom = new CustomStorageAdapter();
      expect(await custom.getSchemaVersion()).to.be.null;
      await custom.setSchemaVersion(5);
      expect(await custom.getSchemaVersion()).to.equal(5);
    });
  });

  describe('Fresh Install Behavior', () => {
    it('exports DEFAULT_MIGRATIONS with baseline v1->v2 migration definition', () => {
      expect(DEFAULT_MIGRATIONS).to.be.an('array');
      expect(DEFAULT_MIGRATIONS.length).to.be.at.least(1);
      expect(DEFAULT_MIGRATIONS[0].version).to.equal(2);
      expect(DEFAULT_MIGRATIONS[0].name).to.equal('v1-to-v2-noop');
    });

    adapterFactories.forEach(({ name, create }) => {
      it(`${name}: fresh install initializes directly to target version without running historical migrations`, async () => {
        const adapter = create();
        await adapter.init();

        let eventEmitted = null;
        const result = await MigrationRunner.run({
          storage: adapter,
          onEvent: (evt) => {
            if (evt.stage === 'complete') eventEmitted = evt;
          },
        });

        expect(result.fresh).to.be.true;
        expect(result.fromVersion).to.be.null;
        expect(result.toVersion).to.equal(CURRENT_SCHEMA_VERSION);
        expect(result.applied).to.deep.equal([]);
        expect(await adapter.getSchemaVersion()).to.equal(CURRENT_SCHEMA_VERSION);

        expect(eventEmitted).to.not.be.null;
        expect(eventEmitted.fresh).to.be.true;
        expect(eventEmitted.toVersion).to.equal(CURRENT_SCHEMA_VERSION);
      });
    });
  });

  describe('Pre-versioned (Legacy v1) Migration & Sample v1->v2 Execution', () => {
    adapterFactories.forEach(({ name, create }) => {
      it(`${name}: detects existing unversioned documents, treats as v1, and migrates to v2 cleanly`, async () => {
        const adapter = create();
        await adapter.init();

        // Simulate legacy v1 database: document exists but schemaVersion is null
        await adapter.saveDoc('legacy-doc-1', {
          id: 'legacy-doc-1',
          name: 'Legacy Receipt',
          pages: JSON.stringify([{ id: 'p1', name: 'Page 1' }]),
        });

        expect(await adapter.getSchemaVersion()).to.be.null;
        const docsBefore = await adapter.listDocs();
        expect(docsBefore.length).to.equal(1);

        const events = [];
        const result = await MigrationRunner.run({
          storage: adapter,
          onEvent: (evt) => events.push(evt),
        });

        expect(result.fresh).to.be.false;
        expect(result.fromVersion).to.equal(1);
        expect(result.toVersion).to.equal(CURRENT_SCHEMA_VERSION);
        expect(result.applied).to.include(2);
        expect(await adapter.getSchemaVersion()).to.equal(CURRENT_SCHEMA_VERSION);

        // Verify document is preserved and intact
        const docsAfter = await adapter.listDocs();
        expect(docsAfter.length).to.equal(1);
        expect(docsAfter[0].id).to.equal('legacy-doc-1');
        expect(docsAfter[0].name).to.equal('Legacy Receipt');

        // Verify events: start, progress, complete
        const stages = events.map((e) => e.stage);
        expect(stages).to.include('start');
        expect(stages).to.include('progress');
        expect(stages).to.include('complete');
      });
    });
  });

  describe('Idempotency & Re-running Migrations', () => {
    it('running migrations on an up-to-date storage does nothing and succeeds cleanly', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.setSchemaVersion(CURRENT_SCHEMA_VERSION);

      const result = await MigrationRunner.run({ storage });
      expect(result.fresh).to.be.false;
      expect(result.fromVersion).to.equal(CURRENT_SCHEMA_VERSION);
      expect(result.toVersion).to.equal(CURRENT_SCHEMA_VERSION);
      expect(result.applied).to.deep.equal([]);
      expect(await storage.getSchemaVersion()).to.equal(CURRENT_SCHEMA_VERSION);
    });

    it('sequential migrations are idempotent and re-runnable', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.saveDoc('doc-1', { id: 'doc-1', name: 'Invoice', pages: [] });

      let callCount = 0;
      const customMigrations = [
        {
          version: 2,
          name: 'add-field-step',
          async up(s) {
            callCount++;
            const doc = await s.getDoc('doc-1');
            doc.migrated = true;
            await s.saveDoc('doc-1', doc);
          },
        },
      ];

      // First run advances to version 2
      const res1 = await MigrationRunner.run({
        storage,
        migrations: customMigrations,
        targetVersion: 2,
      });
      expect(res1.applied).to.deep.equal([2]);
      expect(callCount).to.equal(1);
      expect((await storage.getDoc('doc-1')).migrated).to.be.true;

      // Second run is a no-op because schemaVersion is already 2
      const res2 = await MigrationRunner.run({
        storage,
        migrations: customMigrations,
        targetVersion: 2,
      });
      expect(res2.applied).to.deep.equal([]);
      expect(callCount).to.equal(1);
    });
  });

  describe('Crash Safety, Aborting Mid-Run & Resumability', () => {
    it('does not advance schema version if a migration fails mid-run and preserves existing data', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.saveDoc('safe-doc', { id: 'safe-doc', name: 'Safe Record', pages: [] });
      await storage.setSchemaVersion(1);

      let step2Ran = false;
      let step3Ran = false;

      const buggyMigrations = [
        {
          version: 2,
          name: 'step-2-success',
          async up(s) {
            step2Ran = true;
            const doc = await s.getDoc('safe-doc');
            doc.step2 = true;
            await s.saveDoc('safe-doc', doc);
          },
        },
        {
          version: 3,
          name: 'step-3-failing',
          async up() {
            step3Ran = true;
            throw new Error('Disk full / power loss simulated');
          },
        },
      ];

      let errorEvent = null;
      let threw = false;

      try {
        await MigrationRunner.run({
          storage,
          migrations: buggyMigrations,
          targetVersion: 3,
          onEvent: (evt) => {
            if (evt.stage === 'error') errorEvent = evt;
          },
        });
      } catch (err) {
        threw = true;
        expect(err.message).to.include('Disk full / power loss simulated');
      }

      expect(threw).to.be.true;
      expect(step2Ran).to.be.true;
      expect(step3Ran).to.be.true;

      // Crucial: Step 2 succeeded and was recorded, but Step 3 failed so version stopped at 2
      expect(await storage.getSchemaVersion()).to.equal(2);
      expect(errorEvent).to.not.be.null;
      expect(errorEvent.stage).to.equal('error');
      expect(errorEvent.failedVersion).to.equal(3);

      // Verify safe-doc data from step 2 was committed and not lost
      const docAfter = await storage.getDoc('safe-doc');
      expect(docAfter.name).to.equal('Safe Record');
      expect(docAfter.step2).to.be.true;

      // Resumability: Now fix step 3 and resume migration
      const fixedMigrations = [
        buggyMigrations[0],
        {
          version: 3,
          name: 'step-3-fixed',
          async up(s) {
            const doc = await s.getDoc('safe-doc');
            doc.step3 = true;
            await s.saveDoc('safe-doc', doc);
          },
        },
      ];

      step2Ran = false;
      const resumeResult = await MigrationRunner.run({
        storage,
        migrations: fixedMigrations,
        targetVersion: 3,
      });

      // Step 2 was already at version 2, so it did NOT re-run
      expect(step2Ran).to.be.false;
      // Only step 3 was executed
      expect(resumeResult.applied).to.deep.equal([3]);
      expect(await storage.getSchemaVersion()).to.equal(3);

      const finalDoc = await storage.getDoc('safe-doc');
      expect(finalDoc.step2).to.be.true;
      expect(finalDoc.step3).to.be.true;
    });

    it('cancels mid-run cleanly when AbortSignal is triggered without advancing version', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.setSchemaVersion(1);

      const controller = new AbortController();

      const cancelMigrations = [
        {
          version: 2,
          name: 'aborted-step',
          async up(_s, { signal }) {
            controller.abort();
            if (signal?.aborted) {
              throw new Error('Aborted by signal');
            }
          },
        },
      ];

      let threw = false;
      try {
        await MigrationRunner.run({
          storage,
          migrations: cancelMigrations,
          targetVersion: 2,
          signal: controller.signal,
        });
      } catch {
        threw = true;
      }

      expect(threw).to.be.true;
      expect(await storage.getSchemaVersion()).to.equal(1);
    });
  });

  describe('CopioEngine Integration & Event Dispatching', () => {
    it('engine.init() executes migrations and dispatches copio:migration events on engine and window', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.saveDoc('engine-doc', { id: 'engine-doc', name: 'Contract', pages: [] });

      const engineEvents = [];
      const windowEvents = [];

      const windowHandler = (e) => {
        windowEvents.push(e.detail);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener(COPIO_EVENTS.MIGRATION, windowHandler);
      }

      const engine = new CopioEngine({ storage });
      engine.addEventListener(COPIO_EVENTS.MIGRATION, (e) => {
        engineEvents.push(e.detail);
      });

      const initResult = await engine.init();

      if (typeof window !== 'undefined') {
        window.removeEventListener(COPIO_EVENTS.MIGRATION, windowHandler);
      }

      expect(initResult.migration).to.exist;
      expect(initResult.migration.toVersion).to.equal(CURRENT_SCHEMA_VERSION);
      expect(await engine.getSchemaVersion()).to.equal(CURRENT_SCHEMA_VERSION);

      // Verify events on engine
      expect(engineEvents.length).to.be.greaterThan(0);
      const engineStages = engineEvents.map((e) => e.stage);
      expect(engineStages).to.include('complete');

      if (typeof window !== 'undefined') {
        expect(windowEvents.length).to.be.greaterThan(0);
        const windowStages = windowEvents.map((e) => e.stage);
        expect(windowStages).to.include('complete');
      }
    });

    it('calling engine.listDocuments() before init() automatically executes migrations first', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.saveDoc('auto-doc', { id: 'auto-doc', name: 'Auto Doc', pages: [] });

      // schemaVersion is not yet set
      expect(await storage.getSchemaVersion()).to.be.null;

      const engine = new CopioEngine({ storage });
      // Call listDocuments directly without engine.init()
      const docs = await engine.listDocuments();

      expect(docs.length).to.equal(1);
      expect(docs[0].id).to.equal('auto-doc');
      // Migration was executed before the read was served!
      expect(await engine.getSchemaVersion()).to.equal(CURRENT_SCHEMA_VERSION);
    });

    it('<copio-scanner> forwards copio:migration CustomEvents with bubbles and composed', async () => {
      const storage = new MemoryStorageAdapter();
      await storage.init();
      await storage.saveDoc('scanner-doc', { id: 'scanner-doc', name: 'Doc', pages: [] });

      const customEngine = new CopioEngine({ storage });
      const scanner = document.createElement('copio-scanner');

      let scannerEvent = null;
      scanner.addEventListener(COPIO_EVENTS.MIGRATION, (e) => {
        scannerEvent = e.detail;
      });

      scanner.engine = customEngine;
      document.body.appendChild(scanner);

      await customEngine.init();

      expect(scannerEvent).to.not.be.null;
      expect(scannerEvent.toVersion).to.equal(CURRENT_SCHEMA_VERSION);

      scanner.remove();
    });
  });

  describe('DocRepository Integration', () => {
    it('docRepository.init() runs migrations cleanly', async () => {
      const storage = new MemoryStorageAdapter();
      const repo = new DocRepository(storage);
      expect(await repo.getSchemaVersion()).to.be.null;

      await repo.init();
      expect(await repo.getSchemaVersion()).to.equal(CURRENT_SCHEMA_VERSION);
    });
  });
});
