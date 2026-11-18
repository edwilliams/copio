import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import {
  computeNextVersion,
  bumpSwCacheName,
  updateVersionFileContent,
  parseVersionFromFile,
  promoteChangelog,
  verifyReleaseConsistency,
} from '../scripts/release.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

describe('CPO-065: Release script & version consistency', () => {
  it('computes SemVer bumps for major, minor, patch, and explicit versions', () => {
    assert.equal(computeNextVersion('0.1.7', 'patch'), '0.1.8');
    assert.equal(computeNextVersion('0.1.7', 'minor'), '0.2.0');
    assert.equal(computeNextVersion('0.1.7', 'major'), '1.0.0');
    assert.equal(computeNextVersion('0.1.7', '1.2.3-beta.1'), '1.2.3-beta.1');

    assert.throws(() => computeNextVersion('0.1.7', '0.1.7'), /identical/);
    assert.throws(() => computeNextVersion('0.1.7', 'not-semver'), /Invalid bump/);
  });

  it('increments Service Worker CACHE_NAME automatically', () => {
    const input = "const CACHE_NAME = 'copio-cache-v20'; // bump this on every deploy\n";
    const result = bumpSwCacheName(input);
    assert.equal(result.prevName, 'copio-cache-v20');
    assert.equal(result.nextName, 'copio-cache-v21');
    assert.match(result.content, /'copio-cache-v21'/);
  });

  it('updates and parses fallback VERSION in sdk/version.js', () => {
    const sample = [
      'export const VERSION = typeof __VERSION__ !== \'undefined\'',
      '  ? __VERSION__',
      '  : \'0.1.7\';',
    ].join('\n');

    assert.equal(parseVersionFromFile(sample), '0.1.7');
    const updated = updateVersionFileContent(sample, '0.2.0');
    assert.equal(parseVersionFromFile(updated), '0.2.0');
  });

  it('promotes [Unreleased] section and updates compare links in CHANGELOG.md', () => {
    const changelog = [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Added',
      '- New release automation.',
      '',
      '## [0.1.7] - 2026-11-18',
      '- Previous release.',
      '',
      '[Unreleased]: https://github.com/edwilliams/copio/compare/v0.1.7...HEAD',
      '[0.1.7]: https://github.com/edwilliams/copio/releases/tag/v0.1.7',
      '',
    ].join('\n');

    const promoted = promoteChangelog(changelog, '0.1.8', '2026-11-19');
    assert.match(promoted, /^## \[Unreleased\]\n\n## \[0\.1\.8\] - 2026-11-19\n\n### Added\n- New release automation\./m);
    assert.match(promoted, /^\[Unreleased\]: https:\/\/github\.com\/edwilliams\/copio\/compare\/v0\.1\.8\.\.\.HEAD$/m);
    assert.match(promoted, /^\[0\.1\.8\]: https:\/\/github\.com\/edwilliams\/copio\/compare\/v0\.1\.7\.\.\.v0\.1\.8$/m);
  });

  it('rejects empty [Unreleased] unless allowEmpty is true', () => {
    const emptyChangelog = '# Changelog\n\n## [Unreleased]\n\n## [0.1.7] - 2026-11-18\n- Init\n';
    assert.throws(() => promoteChangelog(emptyChangelog, '0.1.8', '2026-11-19'), /empty/);
    const allowed = promoteChangelog(emptyChangelog, '0.1.8', '2026-11-19', { allowEmpty: true });
    assert.match(allowed, /## \[0\.1\.8\] - 2026-11-19/);
  });

  it('verifies current repository version, sdk/version.js, and CHANGELOG.md match', async () => {
    const { version } = await verifyReleaseConsistency(rootDir);
    assert.ok(version);
    await verifyReleaseConsistency(rootDir, { tag: `v${version}` });
    await assert.rejects(
      () => verifyReleaseConsistency(rootDir, { tag: 'v99.99.99' }),
      /does not match/,
    );
  });

  it('fails verification when sdk/version.js or CHANGELOG.md drifts', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'copio-release-test-'));
    try {
      await writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      await writeFile(path.join(tmpDir, 'sdk-version-placeholder.js'), '');
      await writeFile(path.join(tmpDir, 'CHANGELOG.md'), '# Changelog\n\n## [0.9.0] - 2026-01-01\n');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(path.join(tmpDir, 'sdk'), { recursive: true });
      await writeFile(
        path.join(tmpDir, 'sdk/version.js'),
        "export const VERSION = typeof __VERSION__ !== 'undefined'\n  ? __VERSION__\n  : '0.9.0';\n",
      );

      await assert.rejects(() => verifyReleaseConsistency(tmpDir), /sdk\/version\.js/);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
