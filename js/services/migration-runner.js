// SPDX-License-Identifier: AGPL-3.0
/**
 * Data Migration Framework & Schema Versioning (CPO-013).
 *
 * Ensures backward compatibility, schema version tracking, and safe transitions
 * between data models across all StoragePort implementations (Memory, IndexedDB, OPFS, custom).
 *
 * Contract for custom adapter authors:
 * - Implement `getSchemaVersion(): Promise<number|null>` returning the currently persisted version (or null if unversioned).
 * - Implement `setSchemaVersion(version: number): Promise<void>` saving the new version to persistence.
 *
 * Migrations are:
 * - Sequential: Executed strictly in ascending version order.
 * - Idempotent: Can safely be re-run on partially migrated data without corrupting or duplicating records.
 * - Resumable & Crash-Safe: Schema version is only advanced once each individual migration step completes.
 *   For destructive steps, keep previous records until new ones are committed.
 */

export const CURRENT_SCHEMA_VERSION = 3;

/**
 * @typedef {Object} MigrationContext
 * @property {number} fromVersion - Version transitioning from
 * @property {number} toVersion - Target version of this migration step
 * @property {AbortSignal} [signal] - Optional abort signal
 */

/**
 * @typedef {Object} MigrationDefinition
 * @property {number} version - Integer version this migration advances to
 * @property {string} name - Short identifier for the migration
 * @property {string} [description] - Detailed summary of changes made
 * @property {(storage: import('../adapters/storage/storage-port.js').StoragePort, context: MigrationContext) => Promise<void>} up - Migration function
 */

/**
 * Built-in standard migrations list.
 * @type {MigrationDefinition[]}
 */
export const DEFAULT_MIGRATIONS = [
  {
    version: 2,
    name: 'v1-to-v2-noop',
    description: 'Establishes baseline schema versioning and verifies stored document integrity.',
    async up(storage) {
      // Sample no-op migration to prove the migration path (CPO-013).
      // Idempotently inspects documents to verify schema validity.
      const docs = await storage.listDocs();
      for (const doc of docs) {
        if (!doc || !doc.id) continue;
        if (typeof doc.pages === 'string') {
          try {
            JSON.parse(doc.pages);
          } catch {
            doc.pages = '[]';
            await storage.saveDoc(doc.id, doc);
          }
        }
      }
    },
  },
  {
    version: 3,
    name: 'v2-to-v3-quad-edits',
    description: 'Normalizes page edit stacks to include edits.quad for perspective correction (CPO-075).',
    async up(storage) {
      const docs = await storage.listDocs();
      for (const doc of docs) {
        if (!doc || !doc.id) continue;
        let pages = doc.pages;
        let wasString = false;
        if (typeof pages === 'string') {
          wasString = true;
          try {
            pages = JSON.parse(pages);
          } catch {
            continue;
          }
        }
        if (!Array.isArray(pages)) continue;

        let changed = false;
        for (const page of pages) {
          if (!page || typeof page !== 'object') continue;
          if (!page.edits || typeof page.edits !== 'object') {
            page.edits = { crop: null, quad: null, rotate: 0, filter: 'none' };
            changed = true;
          } else if (!('quad' in page.edits)) {
            page.edits = { ...page.edits, quad: null };
            changed = true;
          }
        }

        if (changed) {
          doc.pages = wasString ? JSON.stringify(pages) : pages;
          await storage.saveDoc(doc.id, doc);
        }
      }
    },
  },
];

/**
 * MigrationRunner executes ordered migration sequences against StoragePort instances.
 */
export class MigrationRunner {
  static get CURRENT_VERSION() {
    return CURRENT_SCHEMA_VERSION;
  }

  static get DEFAULT_MIGRATIONS() {
    return [...DEFAULT_MIGRATIONS];
  }

  /**
   * Runs all necessary migrations on the provided storage instance.
   *
   * @param {Object} options
   * @param {import('../adapters/storage/storage-port.js').StoragePort} options.storage
   * @param {MigrationDefinition[]} [options.migrations=DEFAULT_MIGRATIONS]
   * @param {number} [options.targetVersion=CURRENT_SCHEMA_VERSION]
   * @param {(event: { stage: 'start'|'progress'|'complete'|'error', [key: string]: any }) => void} [options.onEvent]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ fresh: boolean, fromVersion: number|null, toVersion: number, applied: number[] }>}
   */
  static async run({
    storage,
    migrations = DEFAULT_MIGRATIONS,
    targetVersion = CURRENT_SCHEMA_VERSION,
    onEvent,
    signal,
  }) {
    if (!storage) {
      throw new Error('MigrationRunner.run requires a valid storage adapter');
    }

    if (signal?.aborted) {
      throw new Error('Migration aborted before execution');
    }

    let storedVersion = await storage.getSchemaVersion();
    let currentVersion = storedVersion;

    // Fresh install detection:
    // If schemaVersion is null, check if any documents exist in storage.
    if (storedVersion === null || storedVersion === undefined) {
      const docs = await storage.listDocs();
      if (!docs || docs.length === 0) {
        // Fresh installation: set target version directly without executing historical migrations
        await storage.setSchemaVersion(targetVersion);
        const result = {
          fresh: true,
          fromVersion: null,
          toVersion: targetVersion,
          applied: [],
        };
        onEvent?.({
          stage: 'complete',
          ...result,
        });
        return result;
      }

      // Existing documents without schemaVersion -> pre-versioned v1 schema
      currentVersion = 1;
    }

    if (currentVersion === targetVersion) {
      const result = {
        fresh: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        applied: [],
      };
      return result;
    }

    if (currentVersion > targetVersion) {
      console.warn(
        `[CopioMigration] Storage schema version (${currentVersion}) is newer than target version (${targetVersion}).`
      );
      return {
        fresh: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        applied: [],
      };
    }

    // Filter and sort migrations between currentVersion and targetVersion
    const pending = migrations
      .filter((m) => m.version > currentVersion && m.version <= targetVersion)
      .sort((a, b) => a.version - b.version);

    if (pending.length === 0) {
      await storage.setSchemaVersion(targetVersion);
      return {
        fresh: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        applied: [],
      };
    }

    onEvent?.({
      stage: 'start',
      fromVersion: currentVersion,
      toVersion: targetVersion,
      totalPending: pending.length,
    });

    const applied = [];

    for (const migration of pending) {
      if (signal?.aborted) {
        const abortErr = new Error(`Migration aborted before version ${migration.version}`);
        onEvent?.({
          stage: 'error',
          fromVersion: currentVersion,
          toVersion: targetVersion,
          failedVersion: migration.version,
          error: abortErr,
        });
        throw abortErr;
      }

      onEvent?.({
        stage: 'progress',
        version: migration.version,
        name: migration.name,
        fromVersion: currentVersion,
        toVersion: targetVersion,
      });

      try {
        await migration.up(storage, {
          fromVersion: currentVersion,
          toVersion: migration.version,
          signal,
        });

        // Set version only AFTER successful completion of this migration step
        await storage.setSchemaVersion(migration.version);
        currentVersion = migration.version;
        applied.push(migration.version);
      } catch (err) {
        onEvent?.({
          stage: 'error',
          fromVersion: currentVersion,
          toVersion: targetVersion,
          failedVersion: migration.version,
          error: err,
        });
        throw err;
      }
    }

    const result = {
      fresh: false,
      fromVersion: storedVersion ?? 1,
      toVersion: currentVersion,
      applied,
    };

    onEvent?.({
      stage: 'complete',
      ...result,
    });

    return result;
  }
}
