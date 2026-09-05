# Changesets

Use Changesets for public package releases from this monorepo:

- `diffgazer` — live on npm
- `@diffgazer/add` — versioned here, first-publishes in the upcoming release
- `@diffgazer/ui` — versioned here, first-publishes in the upcoming release
- `@diffgazer/keys` — versioned here, first-publishes in the upcoming release

All four take changesets, get versioned by `pnpm run version-packages`, and publish through
`pnpm run release`. `scripts/monorepo/guard-publish.mjs` holds `FIRST_PUBLISH_ALLOWLIST` with all four
names and rejects the whole run if a never-published package outside that list is pending, so a new
public package needs a reviewed PR adding its name before it can reach npm — see
[PACKAGE_GOVERNANCE.md](../PACKAGE_GOVERNANCE.md#first-publish-gate).

Private package manifests are excluded from versioning and tagging through
`privatePackages.version: false` and `privatePackages.tag: false` in `.changeset/config.json`.
The release policy therefore follows each workspace manifest's `private: true` flag rather than a
manually maintained package list that could drift.
