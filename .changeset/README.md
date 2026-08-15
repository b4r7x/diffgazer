# Changesets

Use Changesets for public package releases from this monorepo:

- `diffgazer` — **publishable today**
- `@diffgazer/add` — versioned here, npm publish still gated
- `@diffgazer/ui` — versioned here, npm publish still gated
- `@diffgazer/keys` — versioned here, npm publish still gated

All four take changesets and get versioned by `pnpm run version-packages`. Only `diffgazer` reaches
npm: `scripts/monorepo/guard-publish.mjs` holds `FIRST_PUBLISH_ALLOWLIST = ["diffgazer"]` and rejects
the whole run if a never-published package is pending. Un-gating a scoped package is a separate
reviewed PR that adds only its name to that allowlist — see
[PACKAGE_GOVERNANCE.md](../PACKAGE_GOVERNANCE.md#first-publish-gate). Until then a scoped bump lands
in its CHANGELOG and its `package.json` without an npm release, which is intended.

Private package manifests are excluded from versioning and tagging through
`privatePackages.version: false` and `privatePackages.tag: false` in `.changeset/config.json`.
The release policy therefore follows each workspace manifest's `private: true` flag rather than a
manually maintained package list that could drift.
