# Task T-PUBLISH-WF — Add real npm publish workflow with provenance

**Source findings:** REL-001
**Severity:** Critical
**Phase:** 1
**Blocks:** Public handoff
**Blocked by:** T-LICENSES (provenance attestations reference repo; license must be valid), T-BUNDLE-SLIM (so first publish ships clean tarball), T-SEC-HONO (so first publish doesn't ship known CVEs)

## Goal
`publishConfig.provenance: true` is declared on every public package but no GitHub Actions workflow publishes — provenance attestations require OIDC from CI. The `release-readiness.yml` workflow only gates; it never `npm publish`es. Add a dedicated `release.yml` workflow using `changesets/action@v1` that opens a "Version Packages" PR on merge to `main`, and on merge of THAT PR publishes via `npm publish --provenance` from OIDC.

## Files to touch (allowlist)
- `.github/workflows/release.yml` (NEW)
- `.github/workflows/release-readiness.yml` (move `id-token: write` OFF of this workflow)
- `.changeset/config.json` (verify `access: "public"`, `commit: false` — should already be set; do not modify if correct)
- `package.json` root scripts (do not modify — existing `release: changeset publish --provenance` is correct)
- `PACKAGE_GOVERNANCE.md` (document the publish flow ONE paragraph addition)

## Files NOT to touch
- Any per-package `package.json` (they already declare `publishConfig.provenance`)
- Per-package `prepublishOnly` scripts
- The CHANGELOG generation (changesets handles it)

## Acceptance criteria
- [ ] `.github/workflows/release.yml` exists.
- [ ] Triggers on `push` to `main` (NOT pull_request).
- [ ] Has `concurrency: { group: release-${{ github.ref }}, cancel-in-progress: false }`.
- [ ] Permissions: `contents: write` (for changesets to commit Version PR), `pull-requests: write` (to open Version PR), `id-token: write` (for npm provenance), `issues: write` (changesets-action may need it).
- [ ] Uses `changesets/action@v1` with `publish: pnpm run release` and `version: pnpm run version-packages`.
- [ ] Pinned versions of all actions by full SHA (e.g., `actions/checkout@<sha> # v4.x.y`).
- [ ] Runs `pnpm install --frozen-lockfile` before invoking changesets.
- [ ] Runs `pnpm run release-check` (or at minimum `verify` + `smoke:packages` + `pack --dry-run`) BEFORE publish step.
- [ ] `release-readiness.yml` `permissions:` block NO LONGER includes `id-token: write` (it doesn't publish).
- [ ] `PACKAGE_GOVERNANCE.md` has a "Publish Flow" subsection explaining: contributor adds changeset → merge to main → changesets-action opens Version PR → merge Version PR → publish job fires → npm provenance attestations issued.

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
ls -la .github/workflows/
cat .github/workflows/release.yml | head -50
# Lint workflow (requires `actionlint` if installed, otherwise yamllint or just visual review)
which actionlint && actionlint .github/workflows/release.yml || echo "actionlint not installed, skip"
# Validate yaml
node --eval "import('yaml').then(y => console.log(y.parse(require('fs').readFileSync('.github/workflows/release.yml','utf8'))))" 2>&1 | tail -5
# Confirm release-readiness no longer has id-token: write
grep -A 5 "permissions:" .github/workflows/release-readiness.yml
```

## Notes & references
- Spec 028 §REL-001 and spec 029 §11 confirm this is critical.
- Reference workflow: changesets-action repo README https://github.com/changesets/action.
- For npm trusted publishing (no NPM_TOKEN needed), each package must be configured on npmjs.com under "Trusted Publishers" pointing to this repo's release.yml. The configuration step is OUT of scope for this brief — flag it in your Report under `Follow-up tasks needed`. For now, accept that `secrets.NPM_TOKEN` will be required and reference it in the workflow.
- Use the npm provenance docs: https://docs.npmjs.com/generating-provenance-statements/
- SHA-pinning rationale: SOTA supply chain. Dependabot can keep pins fresh (separate task T-CI-HARDEN).

## Non-goals
- Do not configure trusted publishers on npmjs.com (that's a manual config step, not code).
- Do not bump any package version (changesets handles versioning).
- Do not modify `release-check` script — it already exists and does the right thing.
- Do not add Slack/email notification hooks (separate concern).
- Do not change the CHANGELOG format.

## Reference workflow skeleton (use as starting point, adjust action SHAs)

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write
  id-token: write
  issues: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v4.x
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@<SHA> # v4
        with:
          version: 10.28.2
      - uses: actions/setup-node@<SHA> # v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run release-check
      - uses: changesets/action@<SHA> # v1
        with:
          publish: pnpm run release
          version: pnpm run version-packages
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```
