# Fix Spec — Phase Plan (258 confirmed findings)

Source ledger: `findings.md` (F-001..F-258). Binding decisions: `decisions.md` (D1-D8). Doctrine: `sota-structure/SKILL.md`.

Dependency-ordered phases. Every confirmed finding is assigned to exactly one phase — the earliest phase its fix touches. Gates run between phases per D7 / the refactor-verification protocol: `turbo run type-check` (project refs make boundary breakage a hard error) → FULL `turbo run test` → `prepare:artifacts` + `validate:artifacts:check` + `verify:monorepo` → `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` → `git diff --check`. Cross-package moves use ts-morph codemods; registry/public-surface renames are lockstep (source + `public/r` JSON + generated bundles + docs + examples + app consumers) in one atomic commit per D7.

---

## Phase 1 — Pure moves & renames

Zero logic edits. ts-morph codemods; git-rename-preserving (review shows renames, not delete+add). Folder-context drops, path-echo renames, single-file-folder flattening, mirror-alignment moves, and orchestrator-`index.ts`→concept renames. Single-file-folder collapses that also drop a redundant one-line barrel and repoint the public `exports` map land here (the move is the earliest action; the public contract stays unchanged). Test-file renames/moves are deferred to Phase 7; dead-code deletions to Phase 4; barrel dissolution to Phase 3.

**Naming — folder-context / path-echo / confusable / grab-bag-single-concept renames:**
F-004, F-021, F-022, F-023, F-024, F-025, F-026, F-027, F-028, F-029, F-030, F-031, F-032, F-033, F-034, F-035, F-036, F-039, F-042, F-043, F-044, F-045, F-046, F-047, F-048, F-049, F-050, F-051, F-052, F-053, F-119, F-120, F-121, F-122, F-123, F-124, F-125, F-126, F-127, F-129, F-130, F-131, F-133, F-134, F-145, F-147, F-157, F-158, F-159, F-160, F-185, F-210, F-211, F-214, F-224, F-244

**Structure — single-file-folder collapse, misplacement moves, sub-area promotion, mirror alignment:**
F-010, F-056, F-057, F-058, F-059, F-060, F-061, F-062, F-063, F-064, F-066, F-067, F-068, F-069, F-070, F-071, F-114, F-115, F-116, F-117, F-118, F-135, F-136, F-146, F-149, F-150, F-161, F-162, F-167, F-168, F-169, F-186, F-225, F-227, F-243, F-257

---

## Phase 2 — DRY extractions & architecture / boundary fixes

Promote duplicated logic to the rule-of-two home (libs/core, @diffgazer/registry), delete reimplementations, fix unidirectional-slice violations (shared→feature, feature→feature) and inline-in-route-file architecture defects. Stacked after the pure-move commit so extractions land on already-relocated, correctly-named files.

**DRY (code + build-script duplication):**
F-011, F-077, F-078, F-079, F-080, F-081, F-082, F-083, F-084, F-085, F-104, F-164, F-175, F-177, F-178, F-179, F-188, F-207, F-208, F-216, F-242, F-246

**Architecture / boundary (cross-feature, shared→feature, inline-route, wrong-runtime import):**
F-012, F-054, F-055, F-215, F-241, F-256

---

## Phase 3 — Barrel dissolution (D6)

Remove internal pure re-export barrels; repoint each lib's `exports` map at concrete modules; rewrite self-package barrel/subpath imports to relative paths; shrink the over-fat root `.` entry. KEEP each lib's single public `src/index.ts`, granular subpath exports, and libs/ui per-component `index.ts`. Stacked after moves/renames so the concrete targets exist at their final paths.

F-001, F-007, F-014, F-015, F-016, F-017, F-018, F-019, F-020, F-092, F-105, F-148, F-187, F-245

---

## Phase 4 — Splits & local fixes (SRP, simplicity, dead code, slop)

Split grab-bag files by responsibility, drop dead code/exports/scripts and stale scratch docs, fix ownership inversions and single-caller pass-throughs, de-export internal-only symbols.

**Grab-bag / SRP splits & local refactors:**
F-037, F-040, F-128, F-132, F-151, F-156, F-163, F-180

**Dead code / dead exports / dead scripts / stale scratch docs:**
F-005, F-006, F-008, F-009, F-086, F-087, F-089, F-090, F-091, F-093, F-094, F-095, F-096, F-098, F-099, F-106, F-138, F-139, F-140, F-170, F-171, F-172, F-173, F-197, F-198, F-230, F-247, F-248, F-249, F-250

---

## Phase 5 — Docs-mirror removal (D5) + docs build rework

Delete `apps/docs/registry/` (642-file mirror) and rewrite ~40 `@/components/ui/*` / `@/hooks/*` imports to `@diffgazer/ui` subpaths; fold in the sibling materialization facets (CSS `styles/`, library-assets) and the dgadd CLI doc-dedup + theme-intro dedup that require docs-build/sync changes. Keep `prepare:artifacts` + `validate:artifacts:check` gates.

F-003, F-143, F-176, F-206, F-212

---

## Phase 6 — Dependency hygiene (manifests)

package.json/manifest-only changes: unused/phantom deps, dev-vs-prod misclassification, version drift against the documented floors, peer-dependency contract fixes, missing workspace dep edges, changeset/dependabot coverage. Update lockfiles through pnpm; justify dep placement per AGENTS.md dependency policy.

F-166, F-174, F-192, F-195, F-196, F-202, F-203, F-205, F-213, F-219, F-220, F-221, F-226, F-229, F-231, F-232, F-233, F-234, F-235, F-236, F-237, F-238, F-239, F-240

---

## Phase 7 — Enforcement wiring + test additions / moves

Add dependency-cruiser (layer boundaries, no-circular, no-orphans), knip (dead files/exports/deps, staged adoption), Biome `useFilenamingConvention` (kebab-case + export), lint bans on internal barrels and self-package barrel imports — all as root devDependencies with one-line justification per AGENTS.md. Reconcile Biome config topology and turbo task-graph so enforcement actually fans out. Plus all test-home corrections: colocation moves, phantom-basename splits, dot-segment test renames, tarball/dist test-leak excludes, missing type-check coverage, redundant-test deletion, and the docs/test-config wiring.

**Enforcement / build-config wiring (Biome, turbo, packaging assertions):**
F-013, F-137, F-182, F-190, F-251, F-255

**Tests — colocation, splits, renames, leak excludes, coverage, config:**
F-002, F-038, F-041, F-065, F-072, F-073, F-074, F-075, F-076, F-107, F-108, F-109, F-110, F-111, F-112, F-113, F-142, F-144, F-152, F-153, F-154, F-155, F-183, F-184, F-194, F-209, F-217, F-253, F-254

---

## Phase 8 — Hygiene & docs

Root deletions per D8 and their gitignore knock-ons, AGENTS.md per-surface taxonomy canonization (D3), README/TESTING/copilot/scripts-README truth fixes, tsconfig/editorconfig/CI config-drift hygiene, and remaining doc-vs-tree drift. Sequenced last so docs describe the final tree.

**Root clutter / D8 deletions & gitignore knock-ons:**
F-088, F-097, F-204

**Doc-vs-tree truth fixes:**
F-101, F-102, F-103, F-141, F-223, F-228, F-258

**Config-drift hygiene (tsconfig / editorconfig / CI action-pinning / dev-script):**
F-100, F-165, F-181, F-189, F-191, F-193, F-199, F-200, F-201, F-218, F-222, F-252

---

### Notes on cross-phase findings (earliest-phase rule applied)
- F-010 (validators are build tooling in a misleading `src/`): the dominant action is the **move** to `scripts/registry/` → Phase 1; the redundant `tsconfig.tools.json` cleanup it enables is tracked at F-100 (Phase 8).
- F-044 / F-068 / F-069 / F-070 / F-071 / F-115 (single-file folder + redundant barrel + public-subpath repoint): the **flatten/move** is Phase 1; no separate Phase-3 entry — the public contract is repointed in lockstep during the move.
- F-167 / F-168 (cross-feature imports in cli/diffgazer): the fix is an explicit **pure-move** to a shared tier → Phase 1; the dependency-cruiser rule preventing regression is Phase 7 (F-256/general enforcement).
- F-143 / F-212 (CSS materialization + library-assets): un-enumerated facets of the **D5** mirror removal → Phase 5.
- F-204 (gitignore patterns matching the D8-deleted dumps): lockstep with the **D8** deletions → Phase 8.
- F-013 / F-182 / F-190 (Biome lint coverage, config topology, dead `check` turbo task): prerequisites for the Phase-7 **enforcement** (filename-case + barrel-ban lint) → Phase 7.
- F-110 / F-142 / F-194 (test-only modules leaking into dist/tarball): test-hygiene build excludes + helper colocation → Phase 7.
