#!/usr/bin/env node

/**
 * Copio SDK Release Script (CPO-065)
 *
 * Automates SemVer bumping, sdk/version.js syncing, Service Worker CACHE_NAME
 * bumping, CHANGELOG.md promotion, CI verification, git tagging, and optional
 * npm publishing with provenance.
 *
 * Usage:
 *   node scripts/release.mjs <major|minor|patch|x.y.z> [options]
 *   node scripts/release.mjs --verify [--tag vX.Y.Z]
 *
 * Options:
 *   --dry-run                Preview changes without writing files or running git/npm
 *   --verify                 Verify package.json, sdk/version.js, and CHANGELOG.md match
 *   --tag <vX.Y.Z>           Used with --verify to assert git tag matches package version
 *   --no-checks              Skip `npm run check:ci`
 *   --no-git                 Skip git commit and tag creation
 *   --push                   Push commit and tag to origin (`git push origin HEAD --follow-tags`)
 *   --publish                Publish to npm (`npm publish --provenance --access public`)
 *   --allow-empty-changelog  Allow release when [Unreleased] section has no notes
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

/**
 * Compute the next SemVer string from a current version and bump specifier.
 * @param {string} currentVersion
 * @param {string} bump - 'major' | 'minor' | 'patch' | explicit 'x.y.z'
 * @returns {string}
 */
export function computeNextVersion(currentVersion, bump) {
  const cur = SEMVER_RE.exec(currentVersion);
  if (!cur) {
    throw new Error(`Invalid current version in package.json: "${currentVersion}"`);
  }
  const major = Number(cur[1]);
  const minor = Number(cur[2]);
  const patch = Number(cur[3]);

  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;

  if (SEMVER_RE.test(bump)) {
    if (bump === currentVersion) {
      throw new Error(`Target version "${bump}" is identical to current version "${currentVersion}".`);
    }
    return bump;
  }

  throw new Error(
    `Invalid bump specifier "${bump}". Expected "major", "minor", "patch", or a SemVer string (e.g. "1.0.0").`,
  );
}

/**
 * Increment `const CACHE_NAME = 'copio-cache-vN';` in sw.js.
 * @param {string} swContent
 * @returns {{ content: string, prevName: string, nextName: string }}
 */
export function bumpSwCacheName(swContent) {
  const match = swContent.match(/(const\s+CACHE_NAME\s*=\s*['"])(copio-cache-v)(\d+)(['"])/);
  if (!match) {
    throw new Error('Could not find CACHE_NAME = \'copio-cache-vN\' in sw.js');
  }
  const prevNum = Number(match[3]);
  const nextNum = prevNum + 1;
  const prevName = `${match[2]}${prevNum}`;
  const nextName = `${match[2]}${nextNum}`;
  const content = swContent.replace(match[0], `${match[1]}${nextName}${match[4]}`);
  return { content, prevName, nextName };
}

/**
 * Update fallback VERSION in sdk/version.js to match package.json.
 * @param {string} versionFileContent
 * @param {string} version
 * @returns {string}
 */
export function updateVersionFileContent(versionFileContent, version) {
  const re = /(\?\s*__VERSION__\s*\n\s*:\s*')[^']*(')/;
  if (!re.test(versionFileContent)) {
    throw new Error('Could not find __VERSION__ fallback in sdk/version.js');
  }
  return versionFileContent.replace(re, `$1${version}$2`);
}

/**
 * Extract the fallback VERSION string from sdk/version.js.
 * @param {string} versionFileContent
 * @returns {string|null}
 */
export function parseVersionFromFile(versionFileContent) {
  const match = versionFileContent.match(/\?\s*__VERSION__\s*\n\s*:\s*'([^']+)'/);
  if (match) return match[1];
  const legacyMatch = versionFileContent.match(/export\s+const\s+VERSION\s*=\s*'([^']+)'/);
  return legacyMatch ? legacyMatch[1] : null;
}

/**
 * Promote ## [Unreleased] to ## [nextVersion] - YYYY-MM-DD in CHANGELOG.md.
 * @param {string} changelogContent
 * @param {string} nextVersion
 * @param {string} dateStr - YYYY-MM-DD
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {string}
 */
export function promoteChangelog(changelogContent, nextVersion, dateStr, options = {}) {
  const unreleasedHeading = '## [Unreleased]';
  const idx = changelogContent.indexOf(unreleasedHeading);
  if (idx === -1) {
    throw new Error('CHANGELOG.md is missing "## [Unreleased]" heading.');
  }

  const afterHeadingStart = idx + unreleasedHeading.length;
  const rest = changelogContent.slice(afterHeadingStart);
  const nextReleaseMatch = rest.match(/\n## \[/);
  const unreleasedBody = nextReleaseMatch
    ? rest.slice(0, nextReleaseMatch.index).trim()
    : rest.trim();

  if (!unreleasedBody && !options.allowEmpty) {
    throw new Error(
      'CHANGELOG.md "## [Unreleased]" section is empty. Add release notes before releasing (or pass --allow-empty-changelog).',
    );
  }

  const bodyBlock = unreleasedBody ? `\n\n${unreleasedBody}` : '';
  const tail = nextReleaseMatch ? rest.slice(nextReleaseMatch.index) : '';

  let updated =
    changelogContent.slice(0, idx) +
    `## [Unreleased]\n\n## [${nextVersion}] - ${dateStr}${bodyBlock}` +
    tail;

  // Update Keep a Changelog compare/tag links at bottom if present
  const unreleasedLinkRe = /^\[Unreleased\]:\s*https:\/\/github\.com\/([^/]+\/[^/]+)\/compare\/v([^\s.]+(?:\.[^\s.]+)*)\.\.\.HEAD$/m;
  const linkMatch = updated.match(unreleasedLinkRe);
  if (linkMatch) {
    const repo = linkMatch[1];
    const prevVersion = linkMatch[2];
    updated = updated.replace(
      unreleasedLinkRe,
      `[Unreleased]: https://github.com/${repo}/compare/v${nextVersion}...HEAD\n[${nextVersion}]: https://github.com/${repo}/compare/v${prevVersion}...v${nextVersion}`,
    );
  }

  return updated;
}

/**
 * Verify that package.json, package-lock.json, sdk/version.js, and CHANGELOG.md agree.
 * @param {string} dir
 * @param {{ tag?: string }} [options]
 * @returns {Promise<{ version: string }>}
 */
export async function verifyReleaseConsistency(dir = rootDir, options = {}) {
  const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const version = pkg.version;

  if (options.tag) {
    const expectedTag = `v${version}`;
    if (options.tag !== expectedTag) {
      throw new Error(`Git tag "${options.tag}" does not match package.json version "${expectedTag}".`);
    }
  }

  const lockPath = path.join(dir, 'package-lock.json');
  if (existsSync(lockPath)) {
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    if (lock.version !== version) {
      throw new Error(`package-lock.json version "${lock.version}" does not match package.json "${version}".`);
    }
    if (lock.packages?.['']?.version && lock.packages[''].version !== version) {
      throw new Error(
        `package-lock.json packages[""].version "${lock.packages[''].version}" does not match package.json "${version}".`,
      );
    }
  }

  const versionFile = await readFile(path.join(dir, 'sdk/version.js'), 'utf8');
  const fileVersion = parseVersionFromFile(versionFile);
  if (fileVersion !== version) {
    throw new Error(`sdk/version.js VERSION "${fileVersion}" does not match package.json "${version}".`);
  }

  const changelog = await readFile(path.join(dir, 'CHANGELOG.md'), 'utf8');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRe = new RegExp(`^## \\[${escaped}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');
  if (!headingRe.test(changelog)) {
    throw new Error(`CHANGELOG.md is missing a dated entry "## [${version}] - YYYY-MM-DD".`);
  }

  return { version };
}

function parseArgs(argv) {
  const opts = {
    bump: null,
    dryRun: false,
    verify: false,
    tag: null,
    checks: true,
    git: true,
    push: false,
    publish: false,
    allowEmptyChangelog: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--verify') opts.verify = true;
    else if (arg === '--no-checks') opts.checks = false;
    else if (arg === '--no-git') opts.git = false;
    else if (arg === '--push') opts.push = true;
    else if (arg === '--publish') opts.publish = true;
    else if (arg === '--allow-empty-changelog') opts.allowEmptyChangelog = true;
    else if (arg === '--tag') {
      opts.tag = argv[++i] || null;
    } else if (arg === '--bump') {
      opts.bump = argv[++i] || null;
    } else if (!arg.startsWith('-') && !opts.bump) {
      opts.bump = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function run(cmd, cwd = rootDir) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.verify) {
    const { version } = await verifyReleaseConsistency(rootDir, { tag: opts.tag });
    console.log(`✅ Release consistency verified for v${version}`);
    return;
  }

  if (!opts.bump) {
    throw new Error('Missing version bump argument. Usage: node scripts/release.mjs <major|minor|patch|x.y.z>');
  }

  const pkgPath = path.join(rootDir, 'package.json');
  const lockPath = path.join(rootDir, 'package-lock.json');
  const versionPath = path.join(rootDir, 'sdk/version.js');
  const swPath = path.join(rootDir, 'sw.js');
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');

  const pkgRaw = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const currentVersion = pkg.version;
  const nextVersion = computeNextVersion(currentVersion, opts.bump);
  const dateStr = new Date().toISOString().slice(0, 10);

  const isMajorOneOrAbove = Number(nextVersion.split('.')[0]) >= 1 && Number(currentVersion.split('.')[0]) === 0;
  if (isMajorOneOrAbove) {
    console.log('\n📋 1.0 Gate Reminder: ensure CPO-013 (migrations), CPO-067 (public API), CPO-068 (bundle diet), and E6 (capture polish) are complete.');
  }

  const versionContent = await readFile(versionPath, 'utf8');
  const nextVersionContent = updateVersionFileContent(versionContent, nextVersion);

  const swContent = await readFile(swPath, 'utf8');
  const swBumped = bumpSwCacheName(swContent);

  const changelogContent = await readFile(changelogPath, 'utf8');
  const nextChangelogContent = promoteChangelog(changelogContent, nextVersion, dateStr, {
    allowEmpty: opts.allowEmptyChangelog,
  });

  console.log(`\n🚀 Preparing release: @copio/sdk ${currentVersion} -> ${nextVersion}`);
  console.log(`   - package.json / package-lock.json: ${currentVersion} -> ${nextVersion}`);
  console.log(`   - sdk/version.js: VERSION -> '${nextVersion}'`);
  console.log(`   - sw.js: CACHE_NAME '${swBumped.prevName}' -> '${swBumped.nextName}'`);
  console.log(`   - CHANGELOG.md: [Unreleased] -> [${nextVersion}] - ${dateStr}`);

  if (opts.dryRun) {
    console.log('\n🧪 Dry run complete — no files written.');
    return;
  }

  pkg.version = nextVersion;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  if (existsSync(lockPath)) {
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    lock.version = nextVersion;
    if (lock.packages?.['']) {
      lock.packages[''].version = nextVersion;
    }
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  }

  await writeFile(versionPath, nextVersionContent, 'utf8');
  await writeFile(swPath, swBumped.content, 'utf8');
  await writeFile(changelogPath, nextChangelogContent, 'utf8');

  if (opts.checks) {
    run('npm run check:ci');
  }

  await verifyReleaseConsistency(rootDir);

  if (opts.git) {
    run('git add package.json package-lock.json sdk/version.js sw.js CHANGELOG.md');
    run(`git commit -m "chore(release): v${nextVersion}"`);
    run(`git tag -a "v${nextVersion}" -m "Release v${nextVersion}"`);

    if (opts.push) {
      run('git push origin HEAD --follow-tags');
    } else {
      console.log(`\n📌 Created commit and tag v${nextVersion}. Push with:\n   git push origin HEAD --follow-tags`);
    }
  }

  if (opts.publish) {
    run('npm publish --provenance --access public');
  }

  console.log(`\n✅ Released @copio/sdk v${nextVersion}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`\n❌ Release failed: ${err.message}`);
    process.exit(1);
  });
}
