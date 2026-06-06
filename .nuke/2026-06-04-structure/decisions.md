# Owner Decisions — 2026-06-04 (binding for audit and fix-spec)

Resolved in consultation with the owner after research + verification. Audit agents and the spec MUST honor these; do not re-litigate.

## D1 — Naming
kebab-case files+folders. NO hard hyphen cap. Policy: basename = primary export; **path-echo is a finding** (basename repeating a path segment); 2+ hyphens = shorten-via-folder-context candidate; 3+ = split/rename smell. Target distribution after fixes: ≥85% of source basenames with ≤1 hyphen (elite-repo range), achieved via folder-context moves, never abbreviations. Exempt: `use-` prefix, `<component>-<part>` idiom, tooling dot-suffixes (.test/.spec/.e2e/.stories/.config/.d). **Dot-segments banned** (`x.routes.ts`, `x.service.ts`, `x.command.ts`). Ban grab-bags (utils/helpers/common/misc/shared as basenames). Renames happen NOW (pre-publish window).

## D2 — Grouping
Flat-sibling colocation default (`button.tsx` + `button.test.tsx`). A unit earns a folder at 3+ files. No internal `index.ts` barrels in apps/cli — owner explicitly follows TkDodo. Inside a unit folder, files drop the unit name (`commands/review/command.ts` + `handler.ts`).

## D3 — Taxonomy
Bulletproof PRINCIPLES everywhere (vertical slices, unidirectional imports, rule of two); bulletproof DIR TAXONOMY only on UI surfaces (apps/web, apps/docs, apps/landing, cli/diffgazer TUI). cli/server stays Hono feature-backend (createApp factory + app.route, colocated zod schemas, middlewares/, no controllers). cli/add stays commands/. Canonize per-surface models in AGENTS.md.

## D4 — Monorepo grouping & branding
KEEP `apps/ cli/ libs/` groups, `@diffgazer/*` scope, unscoped `diffgazer` binary, agnostic leaf names. No package moves between groups, no scope rename.

## D5 — Docs registry mirror
REMOVE the apps/docs/registry mirror (642 files). Docs must consume @diffgazer/ui / libs/ui source directly. Audit must verify feasibility and the spec must describe the exact removal path + required docs-build changes. If a hard blocker is found, document it explicitly — but the goal is removal.

## D6 — Barrels
Remove ALL internal pure re-export barrels: apps/web (~15), cli/*, and libs/core internals (~14, case-by-case — the public exports map must keep working, pointed at concrete modules; public contract unchanged). KEEP: each lib's single `src/index.ts` public entry, granular subpath exports, and libs/ui per-component `index.ts` (registry distribution surface — sanctioned public entries). FORBID self-package imports through own barrel/subpath; wire a lint rule.

## D7 — Timing & process
Full structural pass NOW, pre-first-publish. Staged: pure-move/rename commit(s) with zero logic edits → splits/logic stacked after. ts-morph codemods for cross-package moves. Lockstep rule: renames touching public registry surface update source, public/r JSON, generated bundles, docs, examples, and app consumers atomically. Full gates between phases.

## D8 — Root clutter
DELETE (owner: "wszystko usuń"; recoverable from git history): `AUDIT_2026-05-24.md`, `OPUS_AUDIT_2026-05-24.md`, `FIX_SPEC_2026-05-24.md`, `specs/archive/`, dated `audits/` directories. Spec must include these as explicit tasks (after confirming nothing live references them).

## Enforcement (part of the fix scope)
dependency-cruiser (layer boundaries, no-circular, no-orphans) + knip (dead files/exports/deps, staged adoption) as root devDependencies; Biome filename-case kebab; lint ban on internal barrels and self-package barrel imports. Justify dependency placement per AGENTS.md dependency policy.

## Quality bar
The binding doctrine is the `sota-structure` skill: /Users/voitz/.claude/skills/sota-structure/SKILL.md (evidence: references/evidence.md). Repo contract AGENTS.md still overrides where explicit.
