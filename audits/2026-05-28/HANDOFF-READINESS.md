# Diffgazer Handoff-Readiness Verdict

Date: 2026-05-28
Scope: Shipping `@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add`, and `diffgazer` to external users via three paths: (a) shadcn registry, (b) installable npm package, (c) copy-from-source.
Method: Read-only audit of package manifests, public registry JSON, smoke/validate/invariant scripts, governance, and CI workflow. Non-mutating checks only: `npm pack --dry-run --ignore-scripts`, `git ls-files`, `grep` of committed `dist/` and `public/r/`. No builds, no generators, no source edits were run.

## Verification limitation (read this first)

This audit was forbidden from running builds or generators. Therefore it certifies **the logic of the smoke/validate scripts plus the artifacts currently committed/present on disk** — it does NOT certify that those artifacts are in sync with current source. `validate:artifacts:check` and the CI "Public registry is up to date" step only detect drift *after* `prepare:artifacts`/`pnpm run build` regenerates everything; that regeneration was not performed here. A fresh `pnpm install --frozen-lockfile && pnpm run build && pnpm run release-check` on a clean tree is still required before any real handoff.

Every per-path verdict is split into two questions:
- **Artifact/content readiness** — is the committed contract correct and complete? (verifiable now)
- **Published/live readiness** — does it actually work for an external user today? (gated; see below)

### Global gate that caps all three paths

Per `PACKAGE_GOVERNANCE.md` (§Hosted Registry Status, §Consumption Contracts) **nothing is published and the hosted registry is not live**:
- `r.b4r7.dev` does not resolve to a serving registry. Every `npx shadcn add https://r.b4r7.dev/...` snippet is gated as "future use."
- `@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add`, `diffgazer` are not on the public npm registry (treated as publish targets pending `npm view` confirmation).

Consequence: no path is "READY" in the sense of *an external user can run the documented command today*. Paths (a)-live and (b)-from-real-registry are NOT-READY **by definition of not-yet-published**, independent of artifact quality. Path (c) and the local-tarball forms of (a)/(b) are the only paths an external user could exercise today, and only by pointing at this repo / locally packed tarballs.

---

## PATH (a): shadcn registry — NOT-READY (live); artifact-ready (committed contract)

Targets: `libs/ui/public/r/*` (84 JSON files, all git-tracked), `libs/keys/public/r/*` (6 JSON files, all git-tracked), gated by `smoke:shadcn` (`scripts/monorepo/smoke-shadcn-install.mjs`).

**Artifact/content readiness: READY (with the sync caveat above).**
- Both `registry.json` indexes and all representative items exist and are committed. These are the reviewable handoff contract per AGENTS.md and they are present.
- The smoke script enforces the real shadcn contracts and is well-built: keys items carry `target` fields on every file; keys public registry forbids `.js` import specifiers (copy/shadcn breakage guard); UI `registryDependencies` must be direct-URL-localizable (no bare/namespaced deps leaking to direct consumers); transitive theme auto-install is regression-tested (solo `button.json` pulls theme tokens). It exercises both direct-URL and `@ui` / `@diffgazer-keys` namespace install modes, then type-checks AND `vite build`s the fixture and asserts the theme tokens reach final CSS.
- Copy-mode import rewrites verified by the script: installed tree rewrites keys imports to local `@/hooks/use-navigation`, `@/hooks/use-focus-trap`, etc., and aggregates `dialog.css` into `styles/styles.css`.

**Published/live readiness: NOT-READY.**
- Blocking: hosted endpoint `r.b4r7.dev` is not live. The three governance acceptance checks (`/r/ui/registry.json`, `/r/ui/button.json`, `/r/keys/<item>.json` all `200`) cannot pass. Until then the only working shadcn-style install is direct GitHub file copy (path c) or local registry server (what the smoke does in-process).
- The smoke serves the registry from a local in-process HTTP server and **rewrites** the `https://r.b4r7.dev` URLs to `127.0.0.1`. It therefore proves the JSON is *installable*, but proves nothing about the production host, DNS, TLS, or CDN. No CI step asserts the live endpoints (governance asks for one; it does not yet exist in `release-readiness.yml`).

---

## PATH (b): installable npm package — NOT-READY

Targets: `@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add`, `diffgazer`. Gated by `smoke:packages` (`smoke-package-install.mjs`) + pack dry-runs.

**Pack contents (enumerated now via `npm pack --dry-run --json --ignore-scripts`):**

| Package | files | unpacked | declarations | policy files | forbidden leaks |
|---|---|---|---|---|---|
| `@diffgazer/ui` | 137 | ~589 KB | yes (`.d.ts` per component/hook/lib) | LICENSE, README, SECURITY, SUPPORT | none |
| `@diffgazer/keys` | 54 | ~100 KB | yes (`index.d.ts` + per-hook) | all 4 | none |
| `@diffgazer/add` | 8 | ~1012 KB | n/a (CLI, no types entry by design) | all 4 | none |
| `diffgazer` | 44 | ~3371 KB | n/a (CLI) | all 4 | bundles `dist/web` (25 files) — expected |

- `dist/artifacts`, `dialog-shell`, `portal`, and `_types/registry/ui/shared` are correctly excluded from the UI tarball (verified: no leaks). `validate-artifacts.mjs` additionally fails the build if shipped `.d.ts` reference the hidden shared path.
- Exports maps validated by `validate-artifacts.mjs::validatePackageExportTargets` (every `./...` target must exist on disk) and `validateUiPackageExports` (UI exports must match the registry item set, no hidden items exported, no extras/missing).
- `diffgazer` runtime-dependency completeness CHECKED and OK: grep of `cli/diffgazer/dist/*.js` bare external imports yields only `@hono/node-server, @inkjs/ui, @tanstack/react-query, chalk, execa, figlet, hono, ink, ink-spinner, open, react` — all declared in `dependencies`. The third-party server deps (`ai`, `@ai-sdk/google`, `zhipu-ai-provider`, `@openrouter/ai-sdk-provider`, `@hono/zod-validator`, `zod`) are inlined by tsup `noExternal` of `@diffgazer/{core,server,keys}` and do NOT appear as bare imports, so `npm i -g diffgazer` will not break on a missing transitive. `@napi-rs/keyring` is an `optionalDependency` (native), consistent with `cli/server` requiring it.

### BLOCKING GAPS (path b)

1. **`@diffgazer/keys` is an OPTIONAL peer of `@diffgazer/ui`, yet COMMON components STATICALLY import it — and unlike the figlet opt-in path, there is no lazy load and no clear-error fallback.**
   - `libs/ui/package.json` → `peerDependenciesMeta["@diffgazer/keys"].optional = true`. UI has **no `.` barrel export** (verified: every export is a subpath like `./components/select`), so an optional, subpath-specific peer is *architecturally consistent* in principle — the consumer only pulls keys if they import a keys-backed subpath. `PACKAGE_GOVERNANCE.md` line 168 documents and endorses exactly this pattern for the figlet deep import. (Line 167 calling keys "required" is the contradicting half; governance points both ways, so "make it required" is not the self-evidently correct fix.)
   - The real defect is the **figlet/keys asymmetry**, readable directly from dist:
     - `figlet` (niche, only via `./components/logo/figlet`): **lazy** — `import("figlet").then(...).catch(() => throw new Error("... requires the optional peer dependency 'figlet'. Install it with: npm install figlet"))`. Default `logo.js` does not import figlet at all. Graceful, documented, opt-in.
     - `@diffgazer/keys` (COMMON components): **static** — e.g. `select.js:706` and `checkbox.js:188` both do `import { useNavigation } from "@diffgazer/keys";`. Static imports across 18 dist files: `select`, `command-palette`, `checkbox`, `radio`, `accordion`, `tabs`, `sidebar`, `toggle-group`, `diff-view`, plus re-export hooks `use-navigation/use-focus-trap/use-focus-restore/use-scroll-lock`.
   - Effect: a consumer who runs only `npm install @diffgazer/ui` (which the optional-peer flag explicitly permits) and imports `@diffgazer/ui/components/select` gets an **opaque module-resolution failure** for `@diffgazer/keys`, with no warning (pnpm does not warn for a satisfied-as-optional peer) and no actionable error. This is *worse* than the figlet case precisely because Select/Checkbox/Radio/Tabs/Accordion are common components, not a niche logo path.
   - Fix is a genuine judgment call, deciding factor "keys backs common components, figlet backs a niche one": either (i) make `@diffgazer/keys` a **required** peer (protects common-component users; costs Button-only consumers a peer warning), or (ii) keep it optional but match the figlet contract — lazy import + clear runtime error + per-component install docs. Today it is neither: `optional: true` **and** a static import is the combination that breaks.
   - **The package smoke cannot catch this**: both UI fixtures in `smoke-package-install.mjs` set `workspaceDeps: ["@diffgazer/keys"]`, so keys is *always* installed next to UI. The "keys-absent" install is never exercised.

2. **`diffgazer` ships the wrong license in its npm manifest.** `cli/diffgazer/package.json` has `"license": "MIT"`, but its `LICENSE` file is Apache-2.0 (verified: file begins "Apache License / Version 2.0") and `PACKAGE_GOVERNANCE.md` §Licensing states Apache-2.0 covers `cli/diffgazer` (patent grant for the distributable binary). npm publishes the `license` *field*, so the registry would advertise MIT while the tarball ships Apache-2.0 — a real licensing-metadata defect. Fix the field to `"Apache-2.0"`. (No invariant check currently asserts the `license` field; consider adding one.)

3. **Publish gate not satisfied (shared with all paths).** Packages are unpublished; the npm/pnpm/yarn/bun install matrix and `npm view <pkg> version` checks in governance §Release Process steps 6-7 are unrun and unrunnable until first publish.

4. **No pending changesets.** `.changeset/` contains only `README.md`. `release.yml` opens a Version PR only when changesets exist, and `release-readiness.yml` runs `pnpm changeset status --since=origin/main`. With versions already bumped in manifests but no changeset, the changeset-driven publish flow has nothing to release; a changeset must be authored before the documented release path will publish anything. (Note for the reviewer, not necessarily blocking the *first* manual publish.)

**Verdict:** NOT-READY. Gaps 1 and 2 are concrete, fixable, source-level defects independent of the publish gate. Gap 3 caps live-readiness regardless.

---

## PATH (c): copy-from-source — NOT-READY (live install command); artifact-ready (committed contract + logic)

Targets: copy-mode via `dgadd` (`cli/add`) and direct GitHub file copy. Gated by `smoke:cli` (`smoke-cli.mjs`) + `smoke:shadcn` (covers the no-package-only-assumptions rewrite).

**Artifact/content readiness: READY (with sync caveat).**
- `smoke-cli.mjs` is the strongest of the three scripts. It runs the real `dgadd` against a Vite fixture: `init`, `add` of UI + keys items, `list --installed --json`, `diff`, typecheck, build, asserts built CSS, then `remove`. Copy-mode import rewrites verified: `assertCopyFirstCssInstall` confirms the dialog shell does NOT import component-level global CSS (no unpublished-package assumption) and that `dialog.css` is aggregated into `src/styles/styles.css`. `selectable-collection.ts` helper copy is asserted.
- Ownership-aware removal verified: `remove keys/navigation` while copy-mode UI still depends on it is blocked ("Keeping keys/navigation"), the manifest entry and the copied hook are retained, and the fixture still typechecks/builds. This is the AGENTS.md `dgadd remove` ownership contract.
- Two integration modes proven: copy-mode (keys rewritten to local `@/hooks/...`) and package mode (`--integration keys` rewrites to `@diffgazer/keys` and installs the dep, and does NOT copy the local hook). Bare-name rejection (`add button` without namespace) is tested.
- `@diffgazer/add` bundles registry data at build time (`registry-bundle.json`, `keys-copy-bundle.json` integrity-validated by `validate-artifacts.mjs`), so copied components are not linked to workspace source — correct for a published CLI.

**Published/live readiness: NOT-READY.**
- The documented public command `npx @diffgazer/add add ui/button` requires `@diffgazer/add` to be published — it is not. Until then, copy-from-source works only via (i) a locally packed `@diffgazer/add` tarball, or (ii) direct GitHub file copy from `libs/ui/registry/ui/<component>`. Governance already gates these snippets as "future use."

---

## Pre-handoff checklist (blocking items first)

Source/contract fixes (do before any publish):
- [ ] **Resolve the `@diffgazer/keys` optional-peer + static-import breakage.** Either make `@diffgazer/keys` a required peer (remove `optional: true`), OR keep it optional and make the common keys-backed components match the figlet contract (lazy import + clear runtime error). Then add a smoke fixture that installs `@diffgazer/ui` WITHOUT keys and imports a keys-backed subpath, to lock the decision in.
- [ ] **Fix `cli/diffgazer/package.json` `"license"` from `"MIT"` to `"Apache-2.0"`** to match the LICENSE file and governance. Optionally add a `check-invariants.mjs` assertion that each package's `license` field matches its `LICENSE` file.
- [ ] Author changesets for the packages being released (`pnpm run changeset`); otherwise the changeset publish flow releases nothing.

Verification (must run on a clean tree — could not be run in this audit):
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run build` (regenerates `public/r/*`, `dist/*`, bundles) — then confirm `git status --short` is clean (this is the CI "Public registry is up to date" guard; it is the only thing that proves committed artifacts match source).
- [ ] `pnpm run release-check` (artifact prep + validate + type-check + test + strict smoke + package smoke + all four pack dry-runs + monorepo invariants + `git diff --check`).
- [ ] `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` so the network/Next fixtures actually execute instead of skipping.
- [ ] `pnpm audit --prod --audit-level=high` (CI hard gate). Review the moderate advisories listed in governance §Upgrade cadence that the HIGH-only gate lets through.

Post-publish (the part the local smoke explicitly does NOT cover):
- [ ] Bring `r.b4r7.dev` live; confirm `200` on `/r/ui/registry.json`, `/r/ui/button.json`, `/r/keys/<item>.json`; add the CI smoke step governance asks for; then un-gate the hosted snippets in the four README/docs locations.
- [ ] Run the npm/pnpm/yarn/bun install matrix in clean Vite AND Next apps against the *real* published packages (governance §Release Process steps 6-7), building each fixture after adding the `@/*` alias, the CSS import, and the package-mode Tailwind `@source` entry.
- [ ] `npm view @diffgazer/{ui,keys,add} version` and `npm view diffgazer version` to confirm registry availability.

---

## What the smoke/validate scripts DO cover

- **`validate-artifacts.mjs`**: artifact-manifest fingerprint integrity; UI/keys artifact mirror parity; `@diffgazer/add` generated bundle integrity + `dist/generated` parity; UI export targets exist; UI exports == registry item set (no hidden/extra/missing); UI pack surface excludes `dialog-shell`/`portal`/hidden `_types`; shipped `.d.ts` do not reference hidden shared paths; per-package policy files present (and git-tracked under CI); no duplicate demo keys; docs artifact sync.
- **`check-invariants.mjs`**: repository/homepage/bugs metadata; package `name`/`files`/`sideEffects`/exports shape; no `link:`/`file:` local deps; internal deps use `workspace:*`; CLI packages are non-private with correct `bin`; policy + README presence; workspace glob/package-list shape; no nested git repos/locks/workspaces.
- **`smoke-shadcn-install.mjs`**: representative item existence; keys `target` fields; keys no-`.js`-specifier; UI direct-URL-ready `registryDependencies`; install via direct URL AND `@ui`/`@diffgazer-keys` namespaces; local-rewritten import tree; transitive theme auto-install; type-check + `vite build` + CSS-token presence.
- **`smoke-package-install.mjs`**: local-tarball install of all four packages; all UI subpath exports; CSS export resolution; React SSR render; strict (NodeNext) `tsc`; Vite package-mode Tailwind output; optional Next package-mode output; `dgadd --help` / `diffgazer --help` bins resolve.
- **`smoke-cli.mjs`**: full `dgadd` copy-first lifecycle (init/add/list/diff/build/remove) + ownership-aware removal + keys copy-vs-package integration + bare-name rejection, all type-checked and built.

## What the smoke/validate scripts DO NOT cover

- **No real npm-registry install.** Everything is local tarballs / in-process registry server. No `npm view`, no public DNS/TLS/CDN, no published-package install. (Governance states this explicitly.)
- **No package-manager matrix.** npm/pnpm/yarn/bun across Vite + Next against published packages is unrun.
- **The keys-absent `@diffgazer/ui` install is never tested** — fixtures always install `@diffgazer/keys` as a workspace dep, so the optional-peer claim is never falsified (root cause that hides blocking gap #1).
- **Offline by default.** `pnpm run smoke` runs with the network gated; the Next/Vite network fixtures SKIP unless `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` (or fail under `DIFFGAZER_SMOKE_STRICT_SKIPS=1`). A plain local `pnpm run smoke` can pass while silently skipping the heaviest fixtures.
- **No live hosted-registry assertion.** Smoke rewrites `r.b4r7.dev` to localhost; no check hits the real endpoint. Governance asks for a CI step that does; it does not exist yet.
- **No `license`-field vs LICENSE-file check** (which is why blocking gap #2 slipped through).
- **Moderate `pnpm audit` advisories are not gated** — the CI gate is HIGH-only by design; moderates (e.g. the h3/start-server-core transitives noted in governance) surface but do not fail.
- **Artifact sync vs source is only checked after a build.** This read-only audit could not run that build; `validate:artifacts:check` alone, against possibly-stale committed artifacts, is not proof of source parity.

## Scope notes

- `@diffgazer/registry` is `private: true` and bundled into `@diffgazer/add` via tsup `noExternal`; it is NOT a standalone publish target and was not audited as its own npm path.
- `@diffgazer/core`, `@diffgazer/server`, `@diffgazer/web`, `@diffgazer/docs`, `@diffgazer/landing`, `@diffgazer/hub` are private app/runtime internals; `core`/`server`/`keys` are inlined into the `diffgazer` binary, `web` is built into `cli/diffgazer/dist/web`.

## Bottom line

| Path | Artifact/content | Published/live |
|---|---|---|
| (a) shadcn registry | READY (pending sync re-verify) | **NOT-READY** — host not live |
| (b) npm package | **NOT-READY** — keys optional-peer + static-import breakage in common components; diffgazer license-field defect | **NOT-READY** — unpublished |
| (c) copy-from-source | READY (pending sync re-verify) | **NOT-READY** — `@diffgazer/add` unpublished (works via local tarball / GitHub copy only) |

Do not claim "ready for external handoff." Fix the two source defects (UI keys peer, diffgazer license field), author changesets, then run a clean-tree `build` + `release-check` to certify artifact↔source sync, then complete the publish + live-registry + package-manager-matrix gates.
