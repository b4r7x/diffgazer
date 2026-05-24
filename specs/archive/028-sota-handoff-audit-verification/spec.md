# SOTA Handoff Audit Verification

Date: 2026-05-16

Status: read-only consolidation spec. No production code was changed while producing this document.

## Goal

Collect the follow-up audit findings in one place so the next implementation or verification pass can work from a single source of truth.

This spec verifies the previous SOTA audit, records the findings from the follow-up agents, and separates:

- confirmed blockers
- stale or false-positive claims
- additional issues found during local validation
- verification commands required before claiming handoff readiness

## Inputs

- User-provided prior SOTA audit report.
- Follow-up agent audits for release/publishing, licensing/governance, package surfaces, generated artifacts, UI registry, keys registry, CLI, docs content, docs site, docs copy, keys correctness, UI runtime, TypeScript/CI/security, and web composition.
- Local validation with `rg`, package metadata inspection, generated docs counts, workflow inspection, source inspection, and targeted command output reported by agents.

## Verdict

Diffgazer is not yet SOTA handoff-ready.

The core codebase is strong, especially `@diffgazer/keys`, `@diffgazer/ui` primitives, registry generation, and shadcn/copy-mode smoke coverage. The blockers are mostly handoff, deployment, docs, supply-chain, and a few correctness gaps in reusable primitives and `dgadd remove`.

The previous report was directionally right that this is not ready, but several details were stale or overstated.

## Confirmed Critical and High Blockers

### REL-001: No Trusted Publishing Workflow

**Severity:** Critical

`publishConfig.provenance: true` and `changeset publish --provenance` exist, but there is no GitHub Actions workflow that publishes packages with OIDC.

Evidence:

- `package.json` has `release: changeset publish --provenance`.
- `.github/workflows/release-readiness.yml` builds, verifies, and packs, but never runs `changeset publish`, `npm publish`, or `pnpm run release`.
- `release-readiness.yml` grants `id-token: write` even though the workflow is not a publish workflow.

Impact:

Consumers cannot receive provenance-backed packages from the current repo automation. Provenance is configured locally but not operationally true.

Required fix:

- Add a dedicated release workflow using Changesets and npm trusted publishing.
- Move `id-token: write` to the publish job only.
- Configure npm trusted publishers for each public package.
- Decide whether local `pnpm run release` is allowed or should be guarded.

### CLI-001: `dgadd remove` Can Break Retained Dependencies

**Severity:** Critical

`dgadd remove` can delete an installed dependency that is still required by a retained item.

Evidence:

- `ui/dialog` depends on `ui/button`.
- `dialog-action.tsx` imports `Button`.
- Remove retention currently compares direct file paths rather than reverse registry dependencies in `libs/registry/src/cli/workflows/remove.ts`.
- Agent repro: `add ui/dialog`, then `remove ui/button` deleted button files while leaving `ui/dialog` installed.

Impact:

A user can end up with an installed manifest that claims `ui/dialog` is installed but the copied source no longer builds.

Required fix:

- Build reverse dependency ownership into remove.
- Prevent removing an item required by retained installed items unless cascading removal is explicit.
- Add behavior tests for shared dependency retention, cascade/orphan cleanup, and hidden dependency handling.

### CLI-002: `dgadd remove` Leaves Hidden/Transitive Orphans

**Severity:** High

Removing a parent item can leave hidden/transitive installed dependencies behind.

Evidence:

- Agent repro: `add ui/dialog`, then `remove ui/dialog` left `ui/button`, `ui/dialog-shell`, `ui/portal`, `keys/focus-restore`, and similar dependency entries/files.

Impact:

Target apps accumulate stale copied files and manifest entries. Future diffs/removes can become misleading.

Required fix:

- Compute retained dependency graph after requested removals.
- Remove unreferenced dependencies that were installed only for removed items.
- Keep explicit user-installed dependencies.

### CLI-003: `dgadd diff` Ignores Hidden Installed Dependencies

**Severity:** High

Default `dgadd diff` checks public install names and can report "all up to date" while hidden installed dependencies are stale.

Evidence:

- Default diff uses public install names.
- Agent repro: after `add ui/dialog`, `list --installed --all` showed hidden entries, but bare `diff` did not check them.

Required fix:

- Make default diff include all installed manifest entries, or clearly split `diff` and `diff --public`.
- Add smoke assertions for hidden dependency drift.

### DIST-001: Public Registry Host Is Not Live

**Severity:** High

Docs and READMEs point users at `https://diffgazer.com/r/...`, but the host is not currently resolvable.

Evidence:

- Public snippets exist in root README, `libs/ui/README.md`, `libs/keys/README.md`, and keys installation docs.
- Agent `curl -I https://diffgazer.com/r/ui/button.json` and `https://diffgazer.com/r/keys/navigation.json` failed with DNS resolution.
- Local/public registry JSON and shadcn smoke are valid; the deployment endpoint is the gap.

Impact:

Direct shadcn install commands do not work for users outside the repo.

Required fix:

- Deploy and verify the registry host, or mark direct URL commands as future-gated everywhere.
- Add CI/deploy smoke for hosted `/r/ui/registry.json`, `/r/ui/button.json`, `/r/keys/navigation.json`, and schema endpoints.

### DOCS-001: UI API Docs Are Incomplete for 33 of 44 Public Components

**Severity:** High

Generated UI component docs have `props: {}` for 33 of 44 public component docs. The same 33 component MDX pages do not render `<APIReference />`.

Current count:

- Public package component exports: 44
- Generated UI component JSON files: 44
- Empty generated prop tables: 33
- Non-empty prop tables: 11
- Component MDX pages with `<APIReference />`: 11

The prior report's `33/43` count is stale; current state is `33/44`.

Examples:

- `avatar` has empty generated props.
- `button` is a working contrast with non-empty props and `<APIReference />`.

Important detail:

Adding `<APIReference />` alone is not enough. `APIReference` silently renders nothing when props are empty.

Required fix:

- Populate docs metadata or implement extraction for public component props.
- Add `<APIReference />` to public component pages after props exist.
- Add validation that fails when a public package component has an empty prop table unless explicitly exempted.

### DOCS-002: Docs Site Has Broken/Incomplete Production Behavior

**Severity:** High

The docs app is not production handoff-ready.

Evidence:

- `/ui/docs` is linked but can render a 200 page with empty content.
- `apps/docs/package.json` sets `build` to `DOCS_PRERENDER=0 vite build`.
- `build:prerender` exists separately.
- The prerender page list includes non-existent `/docs`.
- Per-page descriptions are loaded but route head only emits title.
- No generated sitemap was observed; `robots.txt` lacks a `Sitemap:` directive.
- Root head lacks canonical, Open Graph, Twitter card, manifest link, and explicit icon links.

Required fix:

- Fix `/ui/docs` default route behavior.
- Decide whether production docs should prerender by default.
- Remove stale `/docs` prerender route.
- Emit per-page description/canonical/social metadata.
- Generate and deploy sitemap, update robots.

### PKG-001: `@diffgazer/ui` Docs Artifact Package Mode Is Blocked by Exports

**Severity:** High

`@diffgazer/ui` packs docs artifacts, but package-mode artifact loading resolves `${packageName}/package.json`, and `@diffgazer/ui` does not export `./package.json`.

Evidence:

- `apps/docs/config/docs-libraries.json` declares `@diffgazer/ui` as an artifact package.
- Artifact loader resolves package roots through package metadata.
- `@diffgazer/keys` exports `./package.json`; `@diffgazer/ui` does not.

Impact:

Installed docs package mode can fail even though artifacts are included in the package.

Required fix:

- Export `./package.json` from `@diffgazer/ui`, or change the artifact loader strategy.
- Add a package-mode docs artifact smoke test.

### SEC-001: Production Dependency Audit Fails

**Severity:** High

Agent-run `pnpm audit --prod --audit-level=moderate` reported 43 vulnerabilities: 14 high, 27 moderate, 2 low.

Reported affected paths include:

- `hono` / `@hono/node-server` in `cli/diffgazer` and `libs/server`
- docs/web Vite/TanStack transitive paths

Required fix:

- Upgrade or override vulnerable dependencies.
- Add an agreed audit gate or documented exception process.
- Re-run `pnpm audit --prod --audit-level=moderate`.

### SEC-002: CI Supply-Chain Hardening Is Incomplete

**Severity:** High

Release readiness uses mutable action tags and lacks dependency/update automation.

Evidence:

- `actions/checkout@v4`
- `pnpm/action-setup@v4`
- `actions/setup-node@v4`
- `ubuntu-latest`
- no workflow `concurrency`
- no `.github/dependabot.yml`
- `id-token: write` on non-publishing workflow

Required fix:

- Pin actions to full SHAs or document why tags are acceptable.
- Add Dependabot for GitHub Actions and package ecosystem.
- Add workflow concurrency.
- Restrict OIDC permissions to publish jobs.

### KEYS-001: `useFocusTrap` Is Boundary Cycling, Not a Full Trap

**Severity:** High

`useFocusTrap` listens on the container. If focus escapes outside the container, future Tab events are not intercepted.

Evidence:

- `libs/keys/src/hooks/use-focus-trap.ts` attaches `keydown` to the container.
- Existing tests dispatch Tab after focus is inside the trap.

Required fix:

- Move trap handling to owner-document capture phase, or add focusin/document-level handling.
- Add tests for focus outside the container, descendants calling `stopPropagation`, iframe ownerDocument, and no tabbables.
- If the intended contract is only boundary wrapping, rename/document it accordingly.

### UI-001: Overlay Hooks Assume Global `window` / `document`

**Severity:** High

Popover/select positioning and overlay listeners use global document/window rather than the owner document/window of the involved elements.

Evidence:

- `useFloatingPosition` reads global `window.innerWidth` / `innerHeight` and listens on global `window`.
- `useOutsideClick` / escape handling attach to global `document`.

Impact:

Library primitives are not iframe/alternate-document safe and do not fully follow the repo ownerDocument rule.

Required fix:

- Resolve owner document/window from trigger/content elements.
- Add cross-document tests for popover/select outside click, escape, and positioning.

### UI-002: Reduced-Motion Coverage Is Incomplete

**Severity:** High

`theme-base.css` defines slide/fade animations, but reduced-motion only disables cursor blink. Select, popover, accordion, and dialog still animate or shorten animations instead of disabling them.

Evidence:

- `libs/ui/styles/theme-base.css` defines `--animate-*`.
- `Select.Content` and `Popover.Content` use non-`motion-safe` slide animations.
- `Accordion.Content` transitions grid rows without motion-reduce.
- `dialog.css` sets duration to `0.01s` rather than disabling animation.

Required fix:

- Define a consistent reduced-motion token/policy.
- Use `motion-safe` classes or neutralize animation tokens under `prefers-reduced-motion: reduce`.
- Add CSS/behavior tests where practical.

## Medium Priority Findings

### GOV-001: Root OSS Governance Is Incomplete

**Severity:** Medium/High

Missing or incomplete:

- root `LICENSE`
- root `NOTICE`, if needed
- root or `.github` `CODE_OF_CONDUCT.md`
- root `CONTRIBUTING.md`
- issue templates
- PR template
- stronger root `SECURITY.md`
- clearer `SUPPORT.md`

Package-local license/security/support files exist for public package tarballs, but repo-level OSS governance is still thin.

Also inconsistent:

- `libs/keys/LICENSE` uses copyright holder `voitz`.
- `libs/ui` and `cli/add` use `diffgazer`.
- `cli/diffgazer` is Apache-2.0 while scoped public packages are MIT, without a clear license matrix.

### DOCS-003: Changelog Coverage Is Incomplete

**Severity:** Medium

There is a UI docs changelog, but no package-level changelogs yet. The pending changeset spans multiple unrelated package changes.

Required fix:

- Decide whether package-level `CHANGELOG.md` files are required before publication.
- Split broad changesets into logical changesets by package/impact.

### DOCS-004: Docs Validation Does Not Catch Empty API Docs

**Severity:** Medium

`validate:registry` passes even when most public component prop tables are empty.

Required fix:

- Add a docs metadata completeness check for every public component export.
- Require explicit exemptions for purely visual/no-prop components.

### ART-001: Generated Artifact Policy Is Mostly Correct, but Workflow Wording Is Misleading

**Severity:** Medium

The prior report's "generated files contradiction" is overstated.

Confirmed behavior:

- `AGENTS.md` says not to commit deterministic generated docs/CLI data.
- `.gitignore` enforces this for generated docs and CLI bundles.
- `libs/ui/public/r` and `libs/keys/public/r` are intentionally committed.

Actual issues:

- Release workflow step name "Generated files are committed" is misleading.
- Clean-tree check runs before later `verify`, which can regenerate artifacts again.
- Validation checks freshness, not tracking policy.

### PKG-002: `@diffgazer/ui` Package Is Large Because It Ships Docs Artifacts

**Severity:** Medium

Dry-run pack reported:

- `@diffgazer/ui`: about 1.50 MB packed, 28.93 MB unpacked, 1160 entries.

The prior report's `26.8 MB` claim is directionally correct; current measured unpacked size is about 28.93 MB.

Required fix:

- Decide whether docs artifacts belong in the runtime package.
- If yes, document the cost and verify package-mode docs.
- If no, move artifacts to a separate package or hosting path.

### PKG-003: Public React Packages Lack `engines.node`

**Severity:** Low/Medium

`@diffgazer/add` and `diffgazer` declare engines. `@diffgazer/keys` and `@diffgazer/ui` do not.

Required fix:

- Add explicit Node engine floors if SSR/build tooling support matters.

### TS-001: TypeScript Baselines Are Uneven

**Severity:** Medium

Prior claims are mostly valid but should be scoped:

- `libs/ui/tsconfig.json` is weaker than keys/core baselines.
- `libs/registry` uses Node16 module resolution.
- Several configs use `skipLibCheck`.
- Apps/docs toolchain versions drift from root versions.

Required fix:

- Decide package-specific TS baseline.
- Align `libs/ui` and `libs/registry` where practical.
- Add invariant checks only for rules the repo truly wants to enforce.

### DEP-001: Dependency Drift and Dedupe Drift Are Not Governed

**Severity:** Medium

Agent-run checks:

- `pnpm outdated -r` reported drift.
- `pnpm dedupe --check` failed.
- There is no root `pnpm.overrides` policy.

Required fix:

- Establish upgrade cadence.
- Add overrides only when needed for security/compatibility.
- Decide whether dedupe/outdated should be CI warnings or release blockers.

### WEB-001: Apps/Web Still Hand-Rolls Some Reusable Keyboard Behavior

**Severity:** Medium

Visual composition is mostly thin and product widgets are not leaking into `libs/ui`. However, several app hooks repeat action-row/navigation mechanics that should delegate to `useActionRowNavigation` or remain explicitly app-specific.

Examples:

- `use-providers-keyboard`
- `use-model-dialog-keyboard`
- `use-api-key-dialog-keyboard`
- `use-trust-form-keyboard`

Required fix:

- Keep app-specific flow decisions in web.
- Delegate reusable action-row mechanics to `libs/keys`.
- Avoid moving product workflows into libraries.

### WEB-002: Apps/Web Duplicates Dialog Escape Behavior

**Severity:** Medium

Provider dialogs register app-level Escape handlers while `DialogContent` / dialog shell already own modal cancel/dismissal behavior.

Required fix:

- Keep search-field Escape overrides.
- Let dialog primitive own modal dismissal where possible.
- Add tests for duplicate close callbacks.

### WEB-003: Guarded Render-Time State Updates Need Review

**Severity:** Medium

Follow-up audit found guarded render-time state synchronization in:

- `use-history-page.ts`
- `trust-permissions/page.tsx`
- `review-progress-view.tsx`

Required fix:

- Verify each case against React guidance.
- Prefer derived values, keyed resets, or explicit events/effects depending on intent.

### I18N-001: Typeahead/Search Are Not Locale-Grade

**Severity:** Medium

Typeahead/search currently use default `toLowerCase`, code-unit splitting, and `startsWith/includes`.

Required fix:

- Decide whether locale-aware matching is part of public contract.
- If yes, use `Intl.Collator`, normalization, and tests for Turkish I, diacritics, composed Unicode, and surrogate pairs.
- If no, document ASCII/simple-case semantics.

### KEYS-002: `useScrollLock()` Default Uses Global `document.body`

**Severity:** Medium

Custom targets are fine, but default `useScrollLock()` uses global `document.body`.

Required fix:

- Consider an owner-document aware default if a trigger/container is known.
- Document limitation if no target is supplied.

### UI-003: Typography Does Not Support Headings

**Severity:** Low/Medium

`Typography` supports only `div`, `p`, and `span`.

Required fix:

- Decide whether `Typography` should support `h1` through `h6`, or keep headings in `SectionHeader` / specific components.
- Update docs/tests accordingly.

### UI-004: `useFormReset` Re-subscribes on Every Render

**Severity:** Low/Medium

Correctness is covered, but subscription churn remains.

Required fix:

- Stabilize subscription if practical.
- Keep behavior tests focused on form reset semantics.

## Claims from the Prior Report That Are False, Stale, or Overstated

### FP-001: Generated Files Policy Contradiction

Verdict: overstated.

The repo intentionally ignores deterministic generated docs/CLI data and commits public `/r` registries. That policy is coherent. The workflow step name and check placement should be cleaned up, but this is not a fundamental contradiction.

### FP-002: `cli/diffgazer/README.md` Published Claim

Verdict: mostly false as stated.

`diffgazer` itself is published (`npm view diffgazer version` returned `0.1.3`). The docs issue is that root wording says all npm package names are publish-gated even though unscoped `diffgazer` is not.

### FP-003: Keys Public Registry Emits Relative `.js` Imports

Verdict: false.

Keys public registry import rewriting is implemented and tested. Shadcn smoke covers no `.js` import leaks.

### FP-004: Keys Copy/Shadcn Installability Is Broken

Verdict: false locally.

Keys public copy/shadcn registry shape passes validation and smoke. The actual blocker is hosted registry deployment, not the local registry contract.

### FP-005: `useTypeaheadBuffer` Is a Keys Public API Gap

Verdict: partial/stale.

`useTypeaheadBuffer` is a hidden UI registry hook, not a keys hook. It does have simple lowercase matching and i18n limitations, but it is not missing from keys docs by mistake.

### FP-006: Accordion Region Must Be Default-On

Verdict: not a blocker under current contract.

Accordion region behavior is explicitly opt-in and tests cover default no-region plus expanded region naming. This can be revisited as API design, but it is not a correctness blocker by itself.

### FP-007: Dialog/Form Primitives Are Broadly Broken

Verdict: stale/overstated.

Dialog, checkbox, radio, and select have much stronger tests now than older audits implied: modal semantics, aria wiring, validity, FormData, reportValidity focus, reset behavior, and nested portal/dialog behavior are covered.

## Confirmed Strengths to Preserve

- `@diffgazer/keys` has strong test coverage for navigation/focus behavior.
- Core focus utilities largely respect `ownerDocument`.
- Focusable vs tabbable separation is strong.
- Dialog uses native `<dialog>` with `showModal()` and good nested portal behavior.
- UI registry source/public parity and shadcn smoke are strong locally.
- Public keys registry strips `.js` copy-mode imports and is tested.
- Package/local smoke coverage is materially useful.
- `apps/web` generally keeps product widgets out of `libs/ui`.
- `libs/ui` mostly contains primitives/compound primitives; `DiffView` is generic enough to be acceptable.

Do not lose these during fixes.

## Verification Plan

Use narrow verification while fixing each area, then final gates.

### Required Before Handoff-Ready Claim

```bash
git status --short
pnpm audit --prod --audit-level=moderate
pnpm dedupe --check
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/keys validate:registry
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/docs test
pnpm --filter @diffgazer/docs build:prerender
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run smoke:packages
pnpm run verify:monorepo
git diff --check
```

### Hosted/Published Verification

Run only once deployment/publishing exists:

```bash
curl -I https://diffgazer.com/r/ui/registry.json
curl -I https://diffgazer.com/r/ui/button.json
curl -I https://diffgazer.com/r/keys/navigation.json
curl -I https://diffgazer.com/schema/diffgazer.json
npm view @diffgazer/add version --json
npm view @diffgazer/ui version --json
npm view @diffgazer/keys version --json
npm view diffgazer version --json
```

After publication, verify npm provenance/attestations through npm's current trusted publishing/provenance tooling.

## Suggested Fix Order

1. Fix `dgadd remove` dependency graph and hidden dependency diff/remove tests.
2. Decide publication/deployment truth: add trusted publishing workflow or remove provenance/public install claims until ready.
3. Deploy or gate `diffgazer.com/r/...` registry URLs.
4. Fix docs route/prerender/metadata/sitemap behavior.
5. Fill UI API docs and add validation for empty public prop tables.
6. Fix `@diffgazer/ui` package artifact exports.
7. Resolve audit vulnerabilities and establish dependency governance.
8. Harden `useFocusTrap`, overlay ownerDocument usage, scroll lock default docs/behavior, and reduced-motion policy.
9. Clean up governance docs/license matrix.
10. Revisit web keyboard/dialog duplication after library fixes stabilize.

## Open Questions

- Should docs artifacts ship inside `@diffgazer/ui`, or should docs consume hosted artifacts only?
- Is `diffgazer` intentionally Apache-2.0 while scoped packages are MIT?
- Should `Typography` support headings, or should headings stay in `SectionHeader` and semantic component APIs?
- Is locale-aware typeahead part of the public contract, or is simple ASCII-ish matching acceptable?
- Should `pnpm audit`, `pnpm outdated`, and `pnpm dedupe --check` be hard CI gates or release-readiness advisory gates?
- Should package-level changelogs be required before first public scoped package release?

