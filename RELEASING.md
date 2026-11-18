# Releasing `@copio/sdk`

`@copio/sdk` follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Major versions are commercially significant (licensing grants perpetual use for the current major version).

## 1.0 Release Gate

Before cutting `v1.0.0` (the first major release), verify all gate requirements are complete:
- **CPO-013**: Data migration framework & schema versioning (`MigrationRunner`)
- **CPO-067**: Public API audit & locked v1.0 export surface (`test/sdk-public-api.test.js`)
- **CPO-068**: Legacy app leftovers removed & `<copio-scanner>` bundle diet
- **E6 (CPO-072–CPO-076)**: Batch capture hardening, live edge detection, and 4-corner perspective correction

## Release Workflow

1. Document upcoming changes under `## [Unreleased]` in [CHANGELOG.md](./CHANGELOG.md).
2. Run the release script (from a clean `master` branch):
   ```bash
   npm run release -- patch   # or minor | major | x.y.z
   ```
   This single command:
   - Bumps `version` in `package.json` and `package-lock.json`
   - Syncs `VERSION` in `sdk/version.js`
   - Increments `CACHE_NAME` in `sw.js`
   - Promotes `## [Unreleased]` in `CHANGELOG.md` to `## [<version>] - YYYY-MM-DD`
   - Runs `npm run check:ci`
   - Verifies all versions and changelog entries match (`npm run release:verify`)
   - Creates the release commit and annotated git tag `v<version>`
3. Push the commit and tag to trigger [`.github/workflows/release.yml`](./.github/workflows/release.yml), which re-verifies tag/version/changelog consistency, runs `npm run check:ci`, publishes to npm with `--provenance`, and creates the GitHub Release:
   ```bash
   git push origin master --follow-tags
   ```

> Tip: Use `npm run release -- patch --dry-run` to preview changes without modifying files.
