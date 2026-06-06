# Recon R3 — Owner's Documented Structure / Naming / Organization Conventions

Date: 2026-06-04 · Agent: R3 (documented conventions) · Mode: READ-ONLY on codebase.
Purpose: distill EVERY rule the owner has already written that bears on file/folder structure,
naming, file splitting, extraction, test placement, or code organization, so the structure
audit does not re-litigate intentional design and knows what the owner actually wants.

Sources read (all under `/Users/voitz/Projects/diffgazer-workspace/`):
`AGENTS.md`, `CLAUDE.md`, `PACKAGE_GOVERNANCE.md`, `TESTING.md`, `CONTRIBUTING.md`, `README.md`,
`agent-skills/diffgazer-project-rules/SKILL.md`, `libs/ui/docs/content/patterns/variants.mdx`,
`audits/2026-05-28/STRUCTURE.md` (+ `findings/structure-srp.md`, `REPO-MAP.md`),
`audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md`, `FIX_SPEC_2026-05-24.md`,
`.nuke/2026-06-03-changed/{context,quality-bar,findings}.md`.
Empirical spot-checks of the live tree are noted inline (R3 ran `find`/`ls`/`grep` to verify each claim).

The single most authoritative document for THIS task is
**`audits/2026-05-28/STRUCTURE.md`** — the owner explicitly wrote it to be "lifted verbatim into
the public docs as the canonical structure guide for the Diffgazer monorepo." Treat it as the
de-facto structure spec. Note it predates the owner's newer personal "one-hyphen / single-word
filename" preference, which it actively contradicts (see Contradictions §D-1).

---

## 1. Intentional By Design — DO NOT flag these as findings later

These are deliberate, documented decisions. A structure audit that flags them is wrong.

### Architecture / ownership boundaries (AGENTS.md "Architecture Boundaries", STRUCTURE.md "Where code belongs by layer")
- The 10-package split is intentional: `libs/{keys,ui,core,registry}`, `cli/{add,server,diffgazer}`,
  `apps/{web,docs,landing}`. Each owns a documented concern (verbatim in AGENTS.md and STRUCTURE.md).
- `libs/core` MUST NOT import from `apps/*` or `cli/*` — directional dependency rule, by design.
- `cli/server` is CLI-internal (not a reusable primitive), bundled into the `diffgazer` binary via
  tsup `noExternal`. Its non-library shape is intentional.
- `cli/diffgazer` is a thin binary (web mode + Ink TUI mode), not a library; it consumes
  core/keys/server. Staying thin is the rule.
- `apps/landing` deliberately uses only `libs/ui` (theme CSS) and carries NO domain/docs logic.
- `apps/docs` consumes `@diffgazer/ui`; it must not mirror it (but see Already-Known §K-1 — the
  current mirror is a partially-accepted exception).

### Registry source-vs-public-artifact split (AGENTS.md "Generated Artifacts", "Registry/CLI/Handoff"; PACKAGE_GOVERNANCE.md "Artifact Packaging")
- `libs/ui/public/r/*.json` and `libs/keys/public/r/*` are **committed on purpose** — they are the
  reviewable handoff contract. Their presence in git is NOT a finding.
- Generated trees `libs/ui/docs/generated`, `libs/keys/docs/generated`, `cli/add/src/generated`
  (and `apps/docs/src/generated`) are deterministic and **must NOT be committed**. Materialize with
  `pnpm run prepare:artifacts`. Their absence from git is correct, not a finding.
- `dist/artifacts` in `@diffgazer/ui`/`@diffgazer/keys` are excluded from npm tarballs by design.
- Public registry source rewriting package imports to local copied paths (copy mode) is by design.
- Public `libs/keys/public/r` TS not emitting relative `.js` specifiers is a deliberate contract.

### Test colocation and naming (TESTING.md line 3; REPO-MAP test density)
- Tests are **colocated with sources** as `<name>.test.ts(x)` — explicitly documented. R3 verified
  334 `*.test.*` files live next to their sources. The `.test.` suffix and colocation are intentional.
- Per-package `testing/` directories hold shared test helpers (NOT a separate `@diffgazer/testing`
  package — extraction deliberately deferred until a 3rd consumer needs the shape, TESTING.md).
- `getByTestId`, `container.querySelector`, `fireEvent`, `vi.mock`, hardcoded waits each have
  documented allowed exceptions with mandatory inline `// <kind>: <why>` annotations (TESTING.md).
  Those annotated exceptions are intentional, not slop.

### Component grouping into folders (verified live; implied by STRUCTURE.md orchestrator pattern)
- `libs/ui/registry/ui/<component>/` groups the component family in one folder: e.g. `button/`
  holds `button.tsx` + `button.test.tsx` + `index.ts`; `dialog/` holds 13 sub-component files
  (`dialog-action.tsx`, `dialog-body.tsx`, `dialog-context.tsx`, …) + `dialog.tsx` + `dialog.test.tsx`
  + `index.ts`. R3 confirmed 93 `index.ts` barrels across libs/apps/cli. **Component-as-folder
  (component + test + barrel together) is the established, intentional pattern** — directly relevant
  to the owner's open question (a). Examples are grouped per-hook/per-component too
  (`libs/keys/registry/examples/use-focus-zone/…`, `libs/ui/registry/examples/diff-view/…`).
- `apps/web` uses feature folders: `src/features/<feature>/{components,hooks}/…` (bulletproof-react
  style). `apps/docs` uses `src/{components,lib,layouts,routes,features}/…`. Both are intentional.

### Variant styling system (AGENTS.md "UI Library Rules"; variants.mdx — canonical)
- CVA for named variant dimensions; CSS files ONLY for what Tailwind cannot express; Records ONLY
  for non-class values; plain Tailwind+`cn()` for single boolean conditionals. The decision order in
  `variants.mdx` is canonical. Shared variant modules live in `registry/lib/*-variants.ts` when 2+
  components share axes (e.g. `selectable-variants.ts`, `segmented-variants.ts`, `input-variants.ts`).
  Do not flag `*-variants.ts` sibling files — they are the documented split target.

### Public API naming (AGENTS.md "Public UI API", "Form Primitives", "Keys Library Rules")
- Value controls: `value`/`defaultValue`/`onChange(value)`. Native wrappers (`Input`,`Textarea`)
  keep native `onChange(event)`. Non-value state keeps semantic names (`open`/`onOpenChange`,
  `highlighted`/`onHighlightChange`, `selectedId`/`onSelect`, `onNavigate`).
- Checkbox/Radio boolean-prop exception (`checked`/`defaultChecked`/`onChange(checked)`/`value:string`)
  is a **documented exception** — not a violation of the value-control rule.
- `Field` owns form/ARIA wiring; `InputGroup` is only a decorated shell. By design.
- Keys callbacks describe semantic events (`onNavigate`, `onZoneChange`, etc.). By design.
- No deprecated aliases before first public release — rename + update everything in lockstep.

### Workspace/build uniformity (STRUCTURE.md "Workspace uniformity"; PACKAGE_GOVERNANCE.md)
- Every ESM package declares `"type":"module"`; every app/lib has the standard
  `build`/`dev`/`type-check`/`test` script set + turbo task. Uniformity is the rule.
- `type-check` covers source + tests + `scripts/` (node-typed `scripts/tsconfig.json`). The
  separate `tsconfig.test.json` per package is intentional (keeps prod type-check fast; prevents
  jest-dom/vitest globals leaking into prod). Do NOT propose re-adding a `*.test.*` exclude.
- Two-license split (MIT for libs/registry/cli-add; Apache-2.0 for cli/diffgazer) with per-package
  `LICENSE`/`SECURITY.md`/`SUPPORT.md`. Intentional.

---

## 2. Owner's Stated Structure Preferences — rules he WANTS enforced (with citations)

### From `audits/2026-05-28/STRUCTURE.md` "SOTA Structure Conventions" (he wrote these to be canonical)

**File size**
- Target **≤ 200 lines** per source file. (STRUCTURE.md "File size")
- **Flag at > 300 lines** — split candidate; must justify (one CVA family / one Zod schema group /
  one state machine) or be broken up.
- **Hard review trigger at > 350 lines** — treat as a defect unless an explicit documented reason exists.
- Count lines per *responsibility*, not per file alone.

**One concern per file (SRP)** (STRUCTURE.md "One concern per file")
- A file owns one concern. A hook file owns one hook + its private-only helpers; extract helpers
  into their own files once independently useful/testable (DOM querying, layout math, typeahead,
  metadata resolution).
- A component file owns one component family; move CVA variants → `*-variants.ts`, internal layout
  sub-components → `*-layouts.tsx` when the main file grows past target.
- A reducer owns action dispatch, not event sub-routing (route 10+ sub-types via a dispatch fn).
- **Orchestrator pattern for splits**: when splitting an oversized file, **keep the original file
  name as the orchestrator** that composes the extracted pieces and re-exports the public surface
  UNCHANGED. Public exports never move/break during a split.
- App components COMPOSE `libs/ui`/`libs/keys`; never reimplement list nav, roving focus, dialog
  focus traps, Field wiring, or ARIA. A keyboard concern that grows past target → extracted
  `use*Keyboard` hook, not inline.

**Function arguments** (STRUCTURE.md "Function arguments")
- 3+ positional params, or 2+ same-typed (esp. boolean) params → single `{ options }` object.
- Recursive/threaded state → named options object (not trailing defaulted positionals).
- Component props ≳ 12 fields → group into named sub-objects (`listState`, `callbacks`, `filter`,
  `refs`, `ui`).
- Hook returns ≳ 12 props across concerns → group into named sub-objects (`stream`, `checks`,
  `completion`, `start`).
- Exception: native wrappers (`Input`/`Textarea`) and standalone `Checkbox`/`Radio`.

**Filename matches primary export** (STRUCTURE.md "Filename matches primary export")
- A file's name matches its primary export: `button.tsx`→`Button`, `use-listbox.ts`→`useListbox`.
- Filenames must not mislead about layer/lifecycle (a `dev-*` file must not hold production logic —
  this is exactly why `dev-server.ts`→`http-server.ts` was renamed, now resolved).
- **Compound-component export consistency**: converge on `XRoot` impl + `export { XRoot as X }`
  everywhere (e.g. `DialogRoot`, `TabsRoot`, `AccordionRoot`). (Still partially open — see §K-3.)

**Single source of truth / no mirrors** (STRUCTURE.md "Single source of truth")
- A shared concept lives in exactly ONE package; no verbatim library copy inside an app.
- Constants/schemas/utilities defined once and imported (no duplicated `sha256`, `escapeForRegex`,
  `parsePortEnv`, integrity hashing, library-id validators, timeout constants, env-var-name literals).
  If a `rootDir` constraint forces a copy, document the rationale in architecture docs.

**Where code belongs by layer** — the same ownership table as AGENTS.md, expanded per package.

### From `AGENTS.md` (the repo contract) — additional organization-relevant rules
- "Do not invent a new pattern when the repo already has one" — match nearby files.
- "Do not make broad refactors, renames, … or public API changes unless the task requires them."
  (A structure audit that proposes mass renames must weigh this — see Contradictions.)
- "Prefer deleting dead code over preserving aliases, fallback branches, or compatibility wrappers
  before the first public release."
- Extraction rules: extract **primitives, not product widgets**; extract only when it "names a real
  concept, removes meaningful duplication, and keeps call sites clearer" — NOT because two files look
  similar. Keep app adapters thin.

### From `CLAUDE.md` / global `~/.claude/CLAUDE.md` (owner's coding philosophy)
- SRP, DRY, KISS, YAGNI; "Quality over quantity. Simplicity over cleverness." Minimal, human-like
  code; no speculative features, no premature abstractions ("3 similar lines > unnecessary helper"),
  no defensive over-engineering, delete unused code completely.
- "If a junior dev couldn't understand it in 30 seconds, simplify it." One clear way to do something.
- Avoid nested ternaries / long nullish chains in JSX — name the decision with a helper. (AGENTS React Rules)

### From `agent-skills/diffgazer-project-rules/SKILL.md`
- Re-states the ownership boundaries and the "extract primitives, not product widgets" rule; mandates
  loading `code-audit`/`anti-slop`/`clean-code`/`code-quality` for any audit. Same content, no new
  structure rules beyond AGENTS.md.

### Owner's NEWER personal preference (stated in the task brief, NOT yet written into repo docs)
- Wants a SOTA file/folder structure following SRP/DRY/KISS/YAGNI.
- **kebab-case file names with AT MOST one hyphen — ideally single-word.**
- Small focused files, top readability.
- Likes bulletproof-react structure; unsure it fits CLI/lib/server code.
- Prefers "agnostic"/non-branded package naming.
- These are aspirational; they are **not** in any committed doc yet and they CONFLICT with the
  existing codebase and STRUCTURE.md (see Contradictions). The audit must reconcile them, not assume
  the repo already follows them.

---

## 3. Already-Known Structure Issues — documented in past audits/specs (with citations)

State verified by R3 against the live tree on 2026-06-04.

### K-1 · apps/docs registry is a full mirror of libs/ui/registry — STILL OPEN (partially accepted)
- Docs: STRUCTURE.md "Single source of truth"; `findings/structure-srp.md` F97 (high, dry),
  F102 (medium, dry), F106 (low, dry), F107 (high, file-organization), F343 (low, dry).
- Live: `apps/docs/registry/` still exists with **642 files** (R3 `find … | wc -l`). The owner has
  not removed it. F343 itself notes it is "intentional artifact sync per prepare-generated.mjs" and
  recommends "document as accepted anti-pattern, not a bug" — i.e. the team is split between
  "remove the mirror" (F97/F107) and "accept it as designed" (F343). `FIX_SPEC_2026-05-24.md:848`
  also flags the docs-hosted registry surface as a "decide: remove or document as mirror" (DOC-016).
- For the audit: this is the single biggest known structure issue. Do not re-discover it from
  scratch; reference K-1 and decide explicitly whether to remove or formally document the mirror.

### K-2 · Oversized / multi-concern files with documented split plans — partly resolved
STRUCTURE.md "Big-File Split Plan" §1–§14 lists 14 named splits. R3 verified current state:
- §1 `use-listbox.ts` (436 LOC) — **DONE**: now `use-listbox.ts` + `use-listbox-dom.ts` +
  `use-listbox-metadata.ts` exist (the split used 2-hyphen names — see D-1).
- §3 `select-content.tsx` — partial: `get-visible-enabled-options.ts` extracted (verified).
- §4 `use-floating-position.ts` — DONE: `compute-floating-position.ts` +
  `floating-position-constants.ts` exist (but reaudit found a leftover parallel `*From` API — see K-4).
- §11–§13 web keyboard hook splits — DONE: `use-model-dialog-focus-trap.ts`,
  `use-review-severity-filter-keyboard.ts`, `use-review-details-tab-keyboard.ts`, etc. exist
  (these are the 4-hyphen filenames — see D-1).
- §6 `config/store.ts` (530 LOC), §7 `review/context.ts` (394 LOC), §8
  `validate-registry-metadata.ts` (547 LOC), §9 `providers.ts` (358 LOC) — status NOT re-verified
  line-by-line here; STRUCTURE.md still lists them as split targets. Audit should re-measure these
  against the >300/>350 thresholds rather than assume they are done.
- The object-args refactor list (STRUCTURE.md "Object-Args Refactor List" §1–§15) and naming-fix list
  (§1 `dev-server.ts`→`http-server.ts`, **DONE** — verified `http-server.ts` exists) are the
  documented backlog; treat already-applied ones as resolved.

### K-3 · Compound-component export inconsistency (`Root`-then-alias not universal) — OPEN
- STRUCTURE.md "Filename matches primary export" + "Notes on adjacent naming findings" (F224):
  some compound components use `export { TabsRoot as Tabs }`, others (`Dialog`) export directly.
  Documented desired end state: `XRoot` + `export { XRoot as X }` everywhere.

### K-4 · Floating-position parallel `*From` API + misleading comment — flagged 2026-06-01
- `audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md` (and FIX_SPEC lines ~205/262): after the §4 split,
  `compute-floating-position.ts` retained four unused object-form `*From` internals with a false
  justifying comment. This is a structure/anti-slop dead-code item in a public-handoff file.

### K-5 · Audit ticket-IDs leaking into runtime/test source — recurring, flagged repeatedly
- AGENTS.md anti-slop rule explicitly bans "audit/ticket-id comments in runtime source (e.g. 'F148',
  'STRUCTURE.md §6')". The 2026-06-01 reaudit still found `KEY-019`/`KEY-020` in
  `libs/keys/src/hooks/use-focus-restore.ts` and `keyboard-provider.tsx`, `slot-07 F10` in CLI menu
  shortcuts, and `F151`/`F155` in a cli/server test. This is an organization-hygiene issue:
  references to the very STRUCTURE.md doc this task relies on must NOT appear in shipped source.

### K-6 · apps/hub stub — RESOLVED
- STRUCTURE.md "Workspace uniformity"/"Where code belongs" (F-hub items) and FIX_SPEC discussed the
  empty `apps/hub` stub (missing `"type":"module"`, no scripts, test:types parity gap). R3 verified
  `apps/hub` **no longer exists** under `apps/` (only `docs`, `landing`, `web`). Treat as resolved;
  do not flag a missing hub. (REPO-MAP and several audits still reference it — those are stale.)

### K-7 · Previous nuke run (2026-06-03-changed) overlap — minimal for structure
- That run was a CHANGED-FILES audit (docs sidebar/TOC/Steps + keys hook docs), not a structure
  audit. Its 18 findings are correctness/test/slop issues on specific changed files, not file/folder
  organization. Only tangential structure overlap: F005 (`TocEntry.key` redundant field — store
  stable IDs), F012 (`splatFromUrl` duplicated across 2 sites — DRY, belongs beside `docsPath`).
  Its `context.md` §2 is a clean restatement of the AGENTS.md conventions (reusable as the
  "intentional design" baseline). No structure decisions there conflict with this run.

---

## 4. Contradictions — where the owner's docs/wishes conflict with each other or with code reality

### D-1 · "At most one hyphen / single-word filenames" vs the entire codebase AND STRUCTURE.md — HARD CONFLICT (the central tension of this task)
- Owner's NEW preference (task brief): kebab-case, **at most one hyphen, ideally single-word**.
- Reality (R3 measured the live tree, source files excl. tests/node_modules/dist/.output):
  - 444 files with 0 hyphens (single-word) ✓ compliant
  - 481 files with exactly 1 hyphen ✓ compliant
  - **320 files with 2 hyphens** ✗
  - **48 files with 3 hyphens** ✗
  - **10 files with 4 hyphens** ✗ (e.g. `use-model-dialog-focus-trap.ts`,
    `use-review-severity-filter-keyboard.ts`, `use-scoped-navigation-focus-within.tsx`,
    `transform-public-registry-keys-imports.ts`, `diff-view-palette-okabe-ito.tsx`)
- **The owner's own STRUCTURE.md split plan MANDATES multi-hyphen names**: `use-listbox-dom.ts`,
  `use-listbox-metadata.ts`, `menu-item-variants.ts`, `menu-item-layouts.tsx`,
  `use-select-typeahead.ts`, `get-visible-enabled-options.ts`, `floating-position-constants.ts`,
  `use-model-dialog-focus-trap.ts`, `use-review-severity-filter-keyboard.ts`,
  `use-providers-list-navigation.ts`, `registry-import-validator.ts`, etc. Many were already applied.
- **The conflict is structural, not cosmetic**: the SRP "extract a sub-concern into a sibling file
  named `<parent>-<subconcern>`" rule (which the owner wrote and applied) inherently produces 2–4
  hyphen names. You cannot simultaneously have (a) ≤200-line single-concern files split off the
  parent, (b) filename-matches-export, and (c) ≤1 hyphen, for hooks like
  `useModelDialogFocusTrap` (an export name that is itself 4 words). Enforcing ≤1 hyphen would force
  either generic/ambiguous names (`focus-trap.ts` losing the model-dialog scope) or breaking
  filename↔export alignment.
- **The audit MUST resolve this explicitly**, e.g. by (i) treating ≤1-hyphen as an aspiration that
  applies to top-level/single-word modules only and folder nesting carries the rest of the scope
  (`providers/model-dialog/focus-trap.ts` instead of
  `providers/hooks/use-model-dialog-focus-trap.ts`), or (ii) relaxing the owner's rule to "match the
  primary export, kebab-cased" (the STRUCTURE.md rule) and dropping the hyphen-count cap. R3 cannot
  pick for the owner — flag it as the #1 decision the audit must surface, with `AskUserQuestion`.

### D-2 · `.test.ts` / `use-x.ts` suffix conventions vs "single-word / one-hyphen" — CONFLICT (owner's open question c)
- `<name>.test.ts(x)` is the documented, universal convention (TESTING.md; 334 files verified) and is
  a multi-segment name. `use-*.ts` is the universal hook convention (181 files verified) and consumes
  the one allowed hyphen before the hook's own (often multi-word) name.
- These are well-established community conventions the codebase fully commits to; they are NOT slop.
  The audit should confirm them as KEEP and explicitly carve them out of any hyphen-count rule
  (the `.test.` segment and the `use-` prefix should not count toward a hyphen budget).

### D-3 · "Component-as-folder (component+test+index together)" — owner's open question (a); repo already answered YES
- Owner asks whether grouping a module into its own folder is recommended or discouraged in 2026.
- The repo has already committed to it: 93 `index.ts` barrels; every UI component is a folder
  (`button/`, `dialog/` with 13+ sub-files). bulletproof-react (the owner's reference) also uses
  feature folders with barrels. There is no documented rule against it. So this is not a
  contradiction in the docs — it is an open question whose answer the repo's own structure already
  embodies. The only live tension is barrel-file overuse (KISS/YAGNI: a 1-file folder with an
  `index.ts` re-export is ceremony). The audit should state a clear rule: folder-per-component when
  the family has 2+ files; avoid single-file folders + barrels that only re-export one symbol.

### D-4 · "No broad renames/refactors unless the task requires them" (AGENTS.md) vs a structure overhaul
- AGENTS.md: "Do not make broad refactors, renames, … unless the task requires them"; "Do not invent
  a new pattern when the repo already has one." A SOTA structure pass that renames hundreds of files
  to satisfy D-1 is, by definition, a broad rename. The task ("SOTA file/folder structure") arguably
  authorizes it, but the audit must acknowledge the cost: renames touch public registry source,
  public registry JSON, generated bundles, docs, examples, and app consumers **in lockstep**
  (AGENTS.md "Registry/CLI/Handoff"; CONTRIBUTING.md). Any structure change in `libs/ui`/`libs/keys`
  registry files is a handoff-contract change requiring `prepare:artifacts` + `validate:artifacts:check`.
  Mass renaming before first publish is cheaper than after — but it is not free.

### D-5 · bulletproof-react fit for CLI/TUI/server — owner's open question (b); no doc answers it
- No committed doc says whether bulletproof-react's app-feature structure applies to `cli/*`/server.
- Code reality: `apps/web`, `apps/docs`, `cli/diffgazer`, and `cli/server` ALL already use
  `src/features/<feature>/…` (verified: `cli/diffgazer/src/features/review/components/…`,
  `cli/server/src/features/review/…`). So the repo has de-facto applied feature-folder structure to
  CLIs and the server too — but `cli/server` also uses `src/shared/lib/<domain>/…` (e.g.
  `shared/lib/config/`, `shared/lib/git/`) which is a different (shared-kernel) layout. This is an
  unstated inconsistency, not a documented rule. The audit should decide and document one model for
  CLI/server (feature-folders are already dominant; `shared/lib` is the divergent island).

### D-6 · "agnostic / non-branded package naming" (owner wish) vs `@diffgazer/*` everywhere
- Every package is `@diffgazer/*` (`@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/core`, …) and the
  public CLI is `diffgazer`; binaries are `diffgazer`/`dgadd`; the registry schema host is
  `diffgazer.com`/`r.b4r7.dev`. PACKAGE_GOVERNANCE.md treats these names as the publish targets.
  The owner now says he prefers agnostic naming. This is a wish in tension with the entire published
  surface, governance doc, and import paths. R3 flags it as an open product decision; renaming the
  scope is a far larger blast radius than file structure and should be decided separately from the
  file/folder audit, not bundled into it.

### D-7 · Stale references to removed `apps/hub` across docs/audits
- `audits/2026-05-28/REPO-MAP.md`, STRUCTURE.md, `deploy/` (hub.Dockerfile, docker-compose hub
  service, REVERSE_PROXY.md), and FIX_SPEC all still describe `apps/hub`, but it no longer exists
  in `apps/`. Internal docs contradict the tree. Minor, but the audit should not resurrect hub and
  should note that hub-referencing deploy assets may now be dead.

---

## 5. Quick-reference: numeric thresholds the audit should apply (owner-documented)
- File size: target ≤200; flag >300; hard trigger >350 (count per responsibility).
- Function args: ≥3 positional OR ≥2 same-typed → options object.
- Component props ≳12 → grouped sub-objects. Hook returns ≳12 → grouped sub-objects.
- Filename ↔ primary export must match (kebab-case of the export name).
- Splits keep the original filename as the orchestrator; public exports never move.
- Hyphen-count cap (≤1, ideally single-word): owner's NEW wish — UNRESOLVED, conflicts with the
  above (D-1). Must be reconciled before enforcement.
