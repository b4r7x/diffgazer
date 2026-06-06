## Phase 8 — Hygiene & docs

Sequenced last so every doc, AGENTS.md taxonomy, gitignore, tsconfig, CI, and dev-script
config describes the FINAL tree: this phase deletes the D8 (+ F-088/F-097 parallel) root
clutter, removes the gitignore knock-ons those deletions leave behind, canonizes the per-surface
taxonomy (D3) into AGENTS.md, and corrects every doc-vs-tree / config-drift truth fault. Running
it last guarantees the prose and config match the structure the earlier phases produced (D5 mirror
removal, D6 barrel dissolution, the move/rename passes) rather than describing an intermediate state.

Cross-phase note: this phase does NOT perform the D5 docs-registry-mirror removal itself — that
belongs to the docs/registry phase. Phase 8 only corrects the documentation/gitignore lines that
DESCRIBE the mirror (README.md:14 in T-803, apps/docs/.gitignore registry/ + styles/ in T-802),
and those tasks are written to be applied whether or not the executor runs them in the same PR as
the D5 removal — they correct prose/ignore-rules to match the post-removal tree.

---

### Batch 8.A — files: agent-specs/ (21 files), libs/ui/specs/ (184 files), AUDIT_2026-05-24.md, OPUS_AUDIT_2026-05-24.md, FIX_SPEC_2026-05-24.md, specs/archive/ (61 files), audits/ (41 files, dated dirs 2026-05-28 / 2026-05-31 / 2026-06-01), .gitignore, apps/docs/.gitignore

Root + per-package clutter deletions (D8 plus the F-088/F-097 parallels) and every gitignore
knock-on. All `.gitignore` edits live here so no other batch touches an ignore file.

- [ ] T-801 (fixes F-088, F-097) — files: agent-specs/, libs/ui/specs/, AUDIT_2026-05-24.md, OPUS_AUDIT_2026-05-24.md, FIX_SPEC_2026-05-24.md, specs/archive/, audits/
      Change: Delete, as a single tracked-clutter removal (recoverable from git history), exactly these
        paths from the worktree via `git rm -r`:
        (1) D8 root dumps: `AUDIT_2026-05-24.md`, `OPUS_AUDIT_2026-05-24.md`, `FIX_SPEC_2026-05-24.md`;
        (2) D8 stale spec/audit trees: `specs/archive/` (61 files) and the entire `audits/` directory
            (41 files; dated dirs `2026-05-28`, `2026-05-31`, `2026-06-01`);
        (3) F-088 parallel: the entire `agent-specs/` directory (21 tracked `.md` files);
        (4) F-097 parallel: the entire `libs/ui/specs/` directory (184 files across the 020-/030- audit dirs).
        DO NOT delete `agent-skills/diffgazer-project-rules/SKILL.md` — it is the current project-rules
        skill and MUST be kept. Before deleting, the executor must have confirmed (already verified during
        audit) that the only inbound references to the three root dumps live inside `audits/` itself
        (audits/2026-05-28/REPO-MAP.md and INDEX.md), which is deleted in the same task, so no live code,
        script, turbo task, or doc outside the deleted set references any target.
      Accept: `git status --short` shows the listed paths as deletions and nothing else under them;
        `agent-skills/diffgazer-project-rules/SKILL.md` is still tracked; `rg -l 'agent-specs/|libs/ui/specs/|AUDIT_2026-05-24|OPUS_AUDIT_2026-05-24|FIX_SPEC_2026-05-24'`
        over the worktree (excluding `.nuke/`, `node_modules`, `pnpm-lock.yaml`) returns zero hits; type-check + full test suite pass.

- [ ] T-802 (fixes F-204, F-191, F-199) — files: .gitignore, apps/docs/.gitignore
      Change:
        (a) F-204 — In root `.gitignore`, delete the three now-dead audit-dump patterns at lines 30-32:
            `AUDIT_*.md`, `OPUS_AUDIT_*.md`, `FIX_SPEC_*.md` (they described artifacts T-801 just removed and
            the repo will no longer produce). KEEP the matching `.dockerignore` entries — they correctly
            exclude any stray dump from the Docker build context, so do NOT touch `.dockerignore`.
        (b) F-191 — Move the three workspace-local generated-tree ignores out of root `.gitignore` lines 23-25
            (`/cli/add/src/generated/`, `/libs/keys/docs/generated/`, `/libs/ui/docs/generated/`) into per-package
            `.gitignore` files at the owning workspace root, matching the existing apps/docs local convention:
            create `cli/add/.gitignore` containing `src/generated/`, `libs/keys/.gitignore` containing
            `docs/generated/`, and `libs/ui/.gitignore` containing `docs/generated/`. Root `.gitignore` keeps only
            truly cross-cutting ignores (node_modules, dist, .turbo, coverage, tmp, *.tsbuildinfo, *.tgz, etc.).
        (c) F-199 — In `apps/docs/.gitignore`, delete the dead line 9 `content/docs/components/` (the sync
            materializer writes component MDX to `content/docs/ui/components/`, never to a top-level
            `content/docs/components/`; the dir has never existed). Keep the live `content/docs/ui/` and
            `content/docs/keys/` materialization ignores.
      Accept: root `.gitignore` no longer contains any `AUDIT_*`/`OPUS_*`/`FIX_SPEC_*` pattern nor any
        `*/generated/` workspace path; `cli/add/.gitignore`, `libs/keys/.gitignore`, `libs/ui/.gitignore` exist
        with their single generated-dir line each; `apps/docs/.gitignore` no longer contains `content/docs/components/`;
        `.dockerignore` is unchanged; `git check-ignore cli/add/src/generated/x` and `libs/ui/docs/generated/x`
        still report ignored; `git status --short` shows no newly-untracked generated output.

---

### Batch 8.B — files: AGENTS.md, README.md, TESTING.md, .github/copilot-instructions.md, libs/registry/README.md, DEPLOYMENT_PLAN.md, scripts/README.md, cli/diffgazer/README.md, libs/ui/README.md, libs/keys/README.md, cli/add/README.md

Documentation truth-sync (every doc now describes the final tree) plus the D3 per-surface taxonomy
canonization. Disjoint from every other batch (no config or source files).

- [ ] T-803 (fixes F-223) — files: README.md
      Change: In `README.md`, amend the workspace bullet (currently line 14
        `- \`apps/docs\` - documentation app and generated registry artifacts`) to drop the
        `and generated registry artifacts` clause, leaving `- \`apps/docs\` - documentation app`.
        This matches the D5 decision that docs consumes `@diffgazer/ui` source directly and no longer
        ships a mirrored registry tree.
      Accept: `README.md` no longer contains the substring `generated registry artifacts`; the apps/docs
        bullet reads `- \`apps/docs\` - documentation app`.

- [ ] T-804 (fixes F-102) — files: TESTING.md
      Change: In `TESTING.md` line 3, change `Vitest 4 for all 9 packages` to `Vitest 4 for all 10 packages`
        and add `apps/landing` to the enumerated parenthetical package list (it has `"test": "vitest run"`,
        a real `App.test.tsx`, and a vitest-axe dependency). The corrected list is the 10 workspaces:
        libs/core, libs/keys, libs/registry, libs/ui, apps/web, apps/docs, apps/landing, cli/add, cli/diffgazer, cli/server.
      Accept: `TESTING.md:3` says `10 packages` and the enumerated list contains `apps/landing`; no other
        package is dropped.

- [ ] T-805 (fixes F-141) — files: .github/copilot-instructions.md
      Change: In `.github/copilot-instructions.md`, replace the wrong `libs/server` workspace bullet (line 18,
        `- \`libs/server\` - private Hono server used by the product.`) with the correct path
        `- \`cli/server\` - private \`@diffgazer/server\` embedded Hono backend.`, and add a missing bullet
        `- \`apps/landing\` - private \`@diffgazer/landing\` marketing/landing page.`, so the "Primary workspace
        roots" list matches README.md:9,16. No other content changes.
      Accept: `.github/copilot-instructions.md` contains no `libs/server` reference, contains a `cli/server`
        bullet and an `apps/landing` bullet; the workspace-root list enumerates all 10 workspaces consistently
        with README.md.

- [ ] T-806 (fixes F-103) — files: libs/registry/README.md
      Change: In `libs/registry/README.md`, delete the self-contradicting "## Compatibility note" section
        (lines 115-119) that names `@diffgazer/registry` as BOTH the legacy and the active package name. The
        package name IS `@diffgazer/registry` and there is no prior published name, so the note conveys nothing.
        Remove the heading and its body; leave the preceding `## License` / `MIT` block intact.
      Accept: `libs/registry/README.md` contains no `Compatibility note` heading and no "legacy standalone
        package name" sentence; the file still ends with valid content (License section intact).

- [ ] T-807 (fixes F-101) — files: DEPLOYMENT_PLAN.md
      Change: In `DEPLOYMENT_PLAN.md`, remove every reference to the removed `apps/hub` deployable and the
        nonexistent `deploy/hub.Dockerfile`: the `b4r7.dev -> hub` routing row (~line 14), the section 2.6
        "Create apps/hub" block (~lines 295-360) including `apps/hub/public/index.html` and `deploy/hub.Dockerfile`,
        the Coolify "hub" service entry (~lines 454-460), the `apps/hub/**` watch-path references, and the hub row
        in the resource table (~lines 584-594). The on-disk truth is `apps/` = {docs, landing, web} only,
        `deploy/hub.Dockerfile` does not exist, and `docker-compose.yml` has no hub service. Keep all
        docs/landing/web deployment content accurate. (If the executor finds DEPLOYMENT_PLAN.md is fully
        superseded by `deploy/REVERSE_PROXY.md` + `docker-compose.yml`, deleting the file is an acceptable
        alternative — but the default is surgical removal of the hub content only.)
      Accept: `rg -i 'hub' DEPLOYMENT_PLAN.md` returns no apps/hub, deploy/hub.Dockerfile, b4r7.dev-hub,
        Coolify-hub-service, or apps/hub watch-path references; OR the file is deleted; the three live
        deployables (docs, landing, web) remain documented.

- [ ] T-808 (fixes F-258) — files: scripts/README.md
      Change: In `scripts/README.md`, replace the stale hand-curated "## Active Files" list (lines 15-21, which
        names only 5 of the 18+ live top-level `scripts/monorepo/` modules) with EITHER (a) a brief statement
        that `package.json` scripts are the source of truth, e.g. "The live monorepo scripts are wired through
        the root `package.json` scripts (verify:monorepo, validate:artifacts:check, smoke:*, bench, smoke:modelsdev,
        release-check); see `package.json` for the authoritative invocation list and `scripts/monorepo/` for the
        modules.", OR (b) a complete grouped enumeration keyed to the root scripts that invoke them, covering at
        least check-invariants.mjs, validate-artifacts.mjs, the smoke-*.mjs family (smoke-cli, smoke-package-install,
        smoke-shadcn-install, smoke-modelsdev, smoke-keys-absent, smoke-shared, smoke-package-fixtures,
        smoke-package-runner), benchmark-server.mjs, registry-closure.mjs, the run-with-artifacts.sh wrapper, and
        the scripts/monorepo/artifacts/ infra subtree. Option (a) is preferred (no future drift).
      Accept: `scripts/README.md` no longer presents a 5-item list implying those are the only active scripts;
        it either points at package.json as source of truth or enumerates the full live surface; no nonexistent
        script is named.

- [ ] T-809 (fixes F-228) — files: cli/diffgazer/README.md, libs/ui/README.md, libs/keys/README.md, cli/add/README.md, README.md
      Change: Make the npm publish-status claim uniform across the published-package READMEs. The root and three
        sibling READMEs all assert the `@diffgazer/*` family is "external publish-gated as of May 2026" with public
        npm commands valid only after `npm view` returns versions (README.md:42, libs/ui/README.md:7,
        libs/keys/README.md:7 & :19, cli/add/README.md:12 & :16). Replace the contradicting block in
        `cli/diffgazer/README.md` (line 36 "The public `diffgazer` npm package is published. Run `npm view diffgazer
        version`..." and the unconditional `npm install -g diffgazer` instruction at lines 39-40) with the same
        publish-gated wording, e.g.: "`diffgazer` is external publish-gated as of May 2026; public
        `npm install -g diffgazer` / `npx diffgazer` commands are valid only after `npm view diffgazer version`
        succeeds. Use the workspace dev/start commands until then." Verify the other four READMEs already match this
        contract and leave them unchanged unless an inconsistency is found; the goal is ONE source of truth for
        publish status across the family.
      Accept: `cli/diffgazer/README.md` no longer states `diffgazer` "is published" nor instructs an unconditional
        `npm install -g diffgazer`; its publish-status language matches the publish-gated wording in
        README.md/libs/ui/libs/keys/cli/add READMEs; `rg -n 'publish-gated' cli/diffgazer/README.md` returns a hit.

- [ ] T-810 (fixes F-088, F-097) — files: AGENTS.md
      Change: This is the documentation half of the F-088/F-097 deletions (T-801 does the file removal). Add a new
        `## Per-Surface Taxonomy` section to `AGENTS.md` (insert it between `## Architecture Boundaries` and
        `## Extraction Rules`) that canonizes the D3 per-surface structure models so AGENTS.md describes the final
        tree as the single source of truth. The section must state, concisely:
          - Bulletproof-react PRINCIPLES apply everywhere (vertical slices, unidirectional imports shared→features→app,
            rule of two, colocate-first).
          - Bulletproof DIR TAXONOMY applies to UI surfaces ONLY: `apps/web`, `apps/docs`, `apps/landing`, and the
            `cli/diffgazer` Ink TUI use `app/` (providers + router + thin routes), on-demand
            `features/<x>/{components,hooks,...}`, and shared `components/{ui,shared,layout}`, `hooks/`, `lib/`,
            `config/`, `types/`, `testing/`.
          - `cli/server` stays a Hono feature-backend: `createApp()` factory separate from the serve entry,
            `features/<domain>/{router,service,schemas,types}` mounted via `app.route()`, colocated zod schemas,
            `shared/{lib,middlewares}/`, NO Rails-style controllers.
          - `cli/add` stays a command-CLI: `commands/` (one file or folder per subcommand, spec+handler split),
            domain logic in `utils/`/lib packages, NOT bulletproof-react taxonomy.
          - Publishable libraries (`libs/core|ui|keys|registry`) organize by domain module behind ONE `src/index.ts`
            public entry plus granular subpath `exports`; NO `features/` taxonomy; `libs/ui` keeps the per-component
            registry folders with colocated tests and per-component `index.ts` (sanctioned distribution surface).
        Keep it short (a table or tight bullet list); do not restate the full Architecture Boundaries section.
      Accept: `AGENTS.md` contains a `## Per-Surface Taxonomy` section placed before `## Extraction Rules` that
        names each of the 10 workspaces' surface model (UI-taxonomy surfaces, Hono server, command CLI, libraries)
        consistent with D3 and context.md §"Per-workspace structure prescriptions"; no contradiction with the
        existing `## Architecture Boundaries` ownership bullets.

---

### Batch 8.C — files: libs/core/tsconfig/base.json, libs/core/tsconfig/node.json, libs/core/tsconfig/react.json, cli/server/tsconfig.json, cli/add/tsconfig.json, cli/add/tsconfig.test.json, libs/registry/tsconfig.json, libs/keys/tsconfig.json, libs/ui/tsconfig.json, libs/ui/tsconfig.tools.json, libs/ui/scripts/tsconfig.json, libs/ui/package.json, apps/web/tsconfig.app.json, apps/landing/tsconfig.app.json, apps/docs/tsconfig.json

All tsconfig topology / compiler-option drift, plus the libs/ui 4th-config consolidation. Disjoint
from the doc batch and from the remaining-config batch (those touch biome/CI/dev-script/test-setup
files only, never a tsconfig).

- [ ] T-811 (fixes F-181, F-189) — files: libs/core/tsconfig/base.json, libs/core/tsconfig/node.json, libs/core/tsconfig/react.json, cli/server/tsconfig.json, cli/add/tsconfig.json, cli/add/tsconfig.test.json, libs/registry/tsconfig.json, libs/keys/tsconfig.json, libs/ui/tsconfig.json
      Change: Make the shared `libs/core/tsconfig/` presets the single source of truth and resolve the
        moduleResolution + `lib` drift:
        (a) Node-emitting packages standardize on NodeNext resolution to match their `tsc` dist emit. `cli/server`
            builds with `tsc` but currently inherits `module: ESNext` / `moduleResolution: Bundler` via
            node.json→base.json while its own `tsconfig.test.json` already overrides to NodeNext — introduce a
            `libs/core/tsconfig/node-nodenext.json` preset (extends node.json, sets `module: NodeNext` +
            `moduleResolution: NodeNext`) and make `cli/server/tsconfig.json`, `cli/add/tsconfig.json`, and
            `libs/registry/tsconfig.json` extend it (dropping their hand-inlined NodeNext options). Point
            `cli/add/tsconfig.test.json` at a node-nodenext test preset so source and tests agree (no Bundler in a
            NodeNext package).
        (b) The four main tsconfigs that currently extend nothing — `cli/add/tsconfig.json`, `libs/registry/tsconfig.json`,
            `libs/keys/tsconfig.json`, `libs/ui/tsconfig.json` — must extend a shared preset and keep only genuine
            package-local deltas: cli/add + libs/registry → the new `node-nodenext.json`; libs/keys + libs/ui →
            `../../libs/core/tsconfig/react.json`.
        (c) Normalize `lib` to one value repo-wide. Either bump the shared `base.json`/`react.json` `lib` to
            `ES2023` (DOM variants added in react.json) so everyone inherits it, OR set `lib: ["ES2022"]` in
            `libs/ui/tsconfig.json` to match base. Pick the bump-base option (least churn) and remove the
            now-redundant inlined `lib: ["ES2023", "DOM", "DOM.Iterable"]` from `libs/ui/tsconfig.json` so it inherits.
        Keep `Bundler` resolution only for the no-emit / vite / tsup-bundled surfaces (apps, libs/ui, libs/keys,
        cli/diffgazer).
      Accept: `cli/server/tsconfig.json`, `cli/add/tsconfig.json`, `libs/registry/tsconfig.json` all resolve to
        `moduleResolution: NodeNext` (via the shared node-nodenext preset) and their test configs agree; no main
        tsconfig in cli/add/libs/registry/libs/keys/libs/ui hand-inlines `target`/`module`/`moduleResolution`/`lib`
        that the preset already provides; `target` and `lib` agree repo-wide (one `lib` value across all 14 configs);
        `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` passes; `cli/server` and `libs/registry`
        `tsc` builds still emit runnable Node ESM.

- [ ] T-812 (fixes F-200, F-201) — files: apps/web/tsconfig.app.json, apps/landing/tsconfig.app.json, apps/docs/tsconfig.json, libs/core/tsconfig/react.json
      Change:
        (a) F-200 — Make both `apps/web/tsconfig.app.json` and `apps/landing/tsconfig.app.json` extend
            `../../libs/core/tsconfig/react.json` and keep only genuinely app-local deltas (vite/client types, path
            aliases, tsBuildInfoFile). The two currently diverge in OPPOSITE directions (web sets the linting flags
            but omits noUncheckedIndexedAccess; landing sets noUncheckedIndexedAccess but omits the linting flags).
            Lift the agreed strictness set — `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess` —
            into `libs/core/tsconfig/react.json` so the two SPAs cannot drift apart again; remove those flags from the
            two app configs once they inherit them.
        (b) F-201 — Set `verbatimModuleSyntax: true` in `apps/docs/tsconfig.json` (currently the only config in the
            repo with it `false`, line 15) to match the shared base preset and both sibling apps, and fix any
            resulting type-only-import errors. If a fumadocs-mdx / TanStack-Start constraint genuinely requires it
            off, instead add an inline comment in apps/docs/tsconfig.json citing the specific constraint so the
            divergence is documented rather than silent — but the default action is to enable it.
      Accept: `apps/web/tsconfig.app.json` and `apps/landing/tsconfig.app.json` both `extends`
        `../../libs/core/tsconfig/react.json`; the strictness set (noUnusedLocals/Parameters/noUncheckedIndexedAccess)
        lives in react.json and is no longer separately inlined in the two apps; `apps/docs/tsconfig.json` has
        `verbatimModuleSyntax: true` (or a justifying comment if off); `turbo run type-check` passes for web, landing, docs.

- [ ] T-813 (fixes F-218) — files: cli/add/tsconfig.json
      Change: In `cli/add/tsconfig.json` line 2, change the broken `$schema` URL from
        `https://json-schema.org/tsconfig` (a nonexistent resource) to the canonical
        `https://json.schemastore.org/tsconfig` used by every other config in the repo (including the sibling
        `cli/add/tsconfig.test.json`).
      Accept: `cli/add/tsconfig.json` `$schema` is `https://json.schemastore.org/tsconfig`; `rg -n 'json-schema.org/tsconfig'`
        across the repo returns zero hits.

- [ ] T-814 (fixes F-100) — files: libs/ui/tsconfig.tools.json, libs/ui/scripts/tsconfig.json, libs/ui/package.json
      Change: Collapse libs/ui from four type-check passes to three (matching libs/keys/libs/core). Delete
        `libs/ui/tsconfig.tools.json` (the ui-only 4th config that double-covers `scripts/` and `shared/` and triple-covers
        `shared/`). Add `tsup.config.ts` (the only file uniquely needing the tools config) to the `include` of
        `libs/ui/scripts/tsconfig.json`, and let `libs/ui/scripts/tsconfig.json` cover `scripts/` plus any relocated
        build validators. Update the `type-check` script in `libs/ui/package.json` (line 319) to drop the
        `-p tsconfig.tools.json` pass so it runs the same 3-config shape as libs/keys/libs/core. NOTE: this task assumes
        the earlier libs/ui src/+shared/ consolidation phase has already relocated the build validators / removed the
        `shared/` folder; if `shared/` still exists when this runs, keep its coverage by adding `shared/**/*.ts` to the
        scripts tsconfig include instead of dropping it.
      Accept: `libs/ui/tsconfig.tools.json` no longer exists; `libs/ui/package.json` `type-check` runs three tsc passes
        (no reference to `tsconfig.tools.json`); `tsup.config.ts` and `scripts/` are still type-checked (no file silently
        drops out of coverage); `pnpm --filter @diffgazer/ui type-check` passes.

---

### Batch 8.D — files: .editorconfig (new), .gitattributes (new), biome.root.json, apps/docs/biome.json, libs/ui/test-setup.ts → libs/ui/src/test-setup.ts, libs/ui/vitest.config.ts, .github/workflows/deploy.yml, cli/add/package.json

Remaining editor/format/CI/dev-script hygiene. Touches no tsconfig (8.C), no doc (8.B), and no
gitignore/clutter (8.A) file, so it is parallel-safe with all three.

- [ ] T-815 (fixes F-193) — files: .editorconfig (new), .gitattributes (new), biome.root.json, apps/docs/biome.json
      Change: The repo has no `.editorconfig` and no `.gitattributes`; with `biome.root.json` formatter disabled
        (`formatter.enabled: false`) and apps/docs the only auto-discoverable Biome config (tab-indented), indentation
        and line-endings are unenforced for editors that do not read Biome.
        (a) Create a root `.editorconfig` encoding the house style: `root = true`; `[*]` block with
            `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `insert_final_newline = true`,
            `charset = utf-8`, `trim_trailing_whitespace = true`. If the apps/docs tab indentation is intentional, add
            an `[apps/docs/**]` override with `indent_style = tab`; otherwise omit the override and converge docs to spaces.
        (b) Create a root `.gitattributes` with `* text=auto eol=lf`, and mark the committed generated trees so they
            stop polluting diffs and language stats: `libs/core/src/catalog/catalog-snapshot.ts linguist-generated=true`,
            `libs/ui/public/r/** linguist-generated=true`, `libs/keys/public/r/** linguist-generated=true` (optionally add
            `-diff` to those globs). Do NOT alter the content of the generated files.
        (c) Do not change `biome.root.json` / `apps/docs/biome.json` content beyond what F-182 (a different phase) owns;
            this task only adds the editor-agnostic configs. The `biome.root.json` and `apps/docs/biome.json` paths are
            listed here only because the editorconfig must encode the SAME indentation policy those Biome configs already
            express — read them to confirm the indent values you encode, but the structural biome-rename/extends work is
            out of scope for this task.
      Accept: root `.editorconfig` exists with `root = true` and a `[*]` block setting space/2/lf/final-newline; root
        `.gitattributes` exists with `* text=auto eol=lf` and `linguist-generated` marks on the three committed generated
        trees; no generated file content changed; type-check + tests still pass.

- [ ] T-816 (fixes F-165) — files: libs/ui/test-setup.ts → libs/ui/src/test-setup.ts, libs/ui/vitest.config.ts
      Change: Standardize the vitest setup-file location on the repo's src-rooted convention (apps/web and apps/landing
        already use `src/test-setup.ts`). Move `libs/ui/test-setup.ts` to `libs/ui/src/test-setup.ts` and update the
        `setupFiles` reference in `libs/ui/vitest.config.ts` (currently `setupFiles: ["./test-setup.ts"]` at line 22) to
        `setupFiles: ["./src/test-setup.ts"]`. Do the move as a pure rename (no content edit to the setup file).
      Accept: `libs/ui/src/test-setup.ts` exists, `libs/ui/test-setup.ts` does not; `libs/ui/vitest.config.ts`
        `setupFiles` points at `./src/test-setup.ts`; `pnpm --filter @diffgazer/ui test` runs with the setup applied
        (jest-dom matchers + cleanup still active).

- [ ] T-817 (fixes F-222) — files: .github/workflows/deploy.yml
      Change: In `.github/workflows/deploy.yml`, pin the lone tag-pinned action `aquasecurity/trivy-action@0.28.0`
        (line 66) to its 40-char commit SHA with a trailing `# v0.28.0` comment, matching the SHA-pinning convention the
        other five `uses:` references in the file follow (e.g. `actions/checkout@de0fac2... # v6.0.2`). Resolve the exact
        commit SHA for the `aquasecurity/trivy-action` `v0.28.0` release tag at edit time and use it; the goal is the
        uniform `uses: <owner>/<action>@<40-hex-sha> # vX.Y.Z` shape so dependabot's github-actions ecosystem updates it
        like the rest.
      Accept: `.github/workflows/deploy.yml` has no `uses:` reference pinned to a non-SHA tag;
        `rg -nE 'uses: .+@[0-9a-f]{40} # v' .github/workflows/deploy.yml` matches the trivy line; the trailing comment
        names the version.

- [ ] T-818 (fixes F-252) — files: cli/add/package.json
      Change: In `cli/add/package.json`, change the `dev` script (line 54, currently `"tsc --watch"`) so the watch loop
        never emits into the tsup-owned `dist/` (today `tsc --watch` writes an un-bundled multi-file build into `dist/`,
        which collides with the single bundled `dist/index.js` that `bin.dgadd` and `files: ["dist"]` ship). Set it to
        type-check-only `"tsc --noEmit --watch"`, OR run via tsx like the sibling CLIs (`cli/diffgazer` and `cli/server`
        dev use tsx, no emit). Keep `dist/` exclusively a tsup build output; do not change the `build` script.
      Accept: `cli/add/package.json` `dev` script no longer emits into `dist/` (it is `tsc --noEmit --watch` or a tsx
        invocation); running `pnpm --filter @diffgazer/add build` still produces the single bundled `dist/index.js`;
        `bin.dgadd` still resolves.

---

### Phase exit

Gates that MUST pass before this phase is considered complete (run in this order; this phase touches
docs, AGENTS.md, gitignore, tsconfig topology, CI, and dev scripts, so the full SOTA-ready gate set
applies — the tsconfig/test-setup changes in 8.C/8.D can shift type-check and test behavior, and 8.B/8.A
touch handoff docs and ignore rules):

1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — green (validates the 8.C tsconfig
   preset/resolution/lib normalization and the apps strictness lift; project references make any boundary
   or resolution regression a hard error).
2. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` — full suite green (validates the F-165
   setup-file move and that the tsconfig changes did not break test compilation).
3. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` — green (this phase touches public
   handoff docs/README and the libs/ui type-check config; confirm registry + docs artifacts still validate).
4. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — green (the cli/add dev-script and tsconfig/module-resolution
   changes can affect CLI/server/web build output; smoke validates the bundled offline snapshot and CLI/package paths).
5. `pnpm run verify:monorepo` — green (validates workspace shape and package metadata after the deletions and
   gitignore reorganization).
6. `git diff --check` — no whitespace errors introduced by the edited docs/config files.

Additional phase-specific checks:
- `rg -l 'agent-specs/|libs/ui/specs/|AUDIT_2026-05-24|OPUS_AUDIT_2026-05-24|FIX_SPEC_2026-05-24'` over the
  worktree (excluding `.nuke/`, `node_modules`, `pnpm-lock.yaml`) returns zero hits (T-801).
- `agent-skills/diffgazer-project-rules/SKILL.md` is still tracked (T-801 must NOT delete it).
- `git check-ignore cli/add/src/generated/x libs/ui/docs/generated/x libs/keys/docs/generated/x` still reports
  all three ignored after the per-package .gitignore move (T-802).
- `rg -n 'json-schema.org/tsconfig'` returns zero hits (T-813); `rg -n 'libs/server' .github/copilot-instructions.md`
  returns zero hits (T-805); `rg -n 'generated registry artifacts' README.md` returns zero hits (T-803).
