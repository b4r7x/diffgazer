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

Private package manifests exclude those workspaces from releases. The `ignore` list records explicit
release-plan exclusions; it is not the inventory of private workspaces.
