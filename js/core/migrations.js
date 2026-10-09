export const CURRENT_SCHEMA_VERSION = 1;

const migrations = [
  // Example migration:
  // {
  //   version: 1,
  //   up: async (store) => {
  //     // migrate to version 1
  //   }
  // }
];

export async function runMigrations(store) {
  let currentVersion = store.getValue('schemaVersion') || 0;

  if (currentVersion === 0 && Object.keys(store.getTable('docs')).length === 0) {
    // Fresh install, set to current version without running migrations
    store.setValue('schemaVersion', CURRENT_SCHEMA_VERSION);
    return;
  }

  // If there's data but no version, it's a v1 legacy install. Set to 1.
  if (currentVersion === 0 && CURRENT_SCHEMA_VERSION >= 1) {
    store.setValue('schemaVersion', 1);
    currentVersion = 1;
  }

  for (const migration of migrations) {
    if (currentVersion < migration.version) {
      console.log(`Running migration to schema version ${migration.version}...`);
      await migration.up(store);
      store.setValue('schemaVersion', migration.version);
      currentVersion = migration.version;
    }
  }
}
