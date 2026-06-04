# Nuke-Audit Report — diffgazer-workspace — 2026-06-03-changed

## Scope

- **Target:** changed-vs-HEAD working-tree diff of the `diffgazer-workspace` monorepo (`@diffgazer/repo`).
- **Surface:** 82 porcelain entries (68 `M` modified + 2 `D` deleted + 12 `??` untracked/new). Primary focus: the `apps/docs` navigation/landing rework (sidebar `terminal` variant, DOM-derived TOC, footer pager, library-root→first-page redirect, Steps MDX block, docs-tree restructuring), plus `libs/keys` hook docs/MDX/registry-example expansion, `libs/ui` sidebar `terminal` variant + docs content, and the `libs/registry` docs-sync `extraRootPages` mechanism.
- **Mode:** read-only audit. Convergence-loop audit with parallel auditor waves and a skeptic confirm/refute gate.

## Dates & rounds

- **Started:** 2026-06-03 · **Spec authored:** 2026-06-04.
- **Round 1:** 105 auditors (99 chunk auditors on axis A + 4 cross-cutting + 2 security surfaces). 73 candidates -> 18 confirmed, 32 duplicates, 22 rejected. dry = 0.
- **Round 2 — VOID:** 30 auditors dispatched; ALL lost to the API weekly rate limit (HTTP 429) before any audit work happened. This wave produced zero findings and does NOT count toward convergence. Rate-limit incident: one full auditor wave was voided.
- **Round 2 (real):** 30 auditors (26 lens x chunk on axis B + 3 cross-cutting whole-scope + 3 fresh-eyes + 1 miss-hunter; capped at 30 by user directive). 4 candidates -> 0 confirmed new, 0 duplicates, 4 rejected (R-023..R-026). dry = 1.

**Dry trail:** `18 -> 0 (4 candidates, all refuted)`.

> **Honest convergence note:** The nuke-audit skill default is TWO consecutive dry rounds before closing the loop. This audit was closed after ONE dry round (Round 2 real) by explicit USER DIRECTIVE, and Round 2 was additionally CAPPED at 30 auditors (below the natural wave size) by the same directive. The void Round 2 (rate-limit loss) was correctly re-run rather than counted. Residual risk from one-dry-round closure is judged low — the change set carries no critical/high findings, no structural moves, and the second real round surfaced only four candidates, all cleanly refuted on intentional-design / out-of-scope / churn grounds.

## Findings summary

**By severity (18 confirmed):** 0 critical / 0 high / 5 medium / 10 low / 3 info.

| Severity | Count | IDs |
|----------|-------|-----|
| critical | 0 | — |
| high | 0 | — |
| medium | 5 | F-001, F-002, F-007, F-017, F-018 |
| low | 10 | F-003, F-004, F-005, F-008, F-010, F-012, F-013, F-014, F-015, F-016 |
| info | 3 | F-006, F-009, F-011 |

**By lens:**

| Lens | Count | IDs |
|------|-------|-----|
| correctness | 4 | F-001 (med), F-013 (low), F-014 (low), F-018 (med) |
| tests | 4 | F-002 (med), F-003 (low), F-004 (low), F-010 (low) |
| errors | 2 | F-007 (med), F-015 (low) |
| conventions | 3 | F-008 (low), F-016 (low), F-017 (med) |
| slop | 2 | F-005 (low), F-011 (info) |
| simplicity | 1 | F-009 (info) |
| types | 1 | F-006 (info) |
| dry | 1 | F-012 (low) |

> F-018 is logged under the correctness lens in the ledger (docs-sync cache fingerprint omission). Correctness therefore carries 4 findings total, of which 2 are medium (F-001, F-018).

**Rejected:** 26 candidates (R-001..R-026) — refuted as pre-existing/out-of-scope, intentional design, or churn. Do not re-report.

## Scorecard (1-5; 5 = no issues found)

Scored from the ledger: lenses with zero confirmed findings that survived both real waves score 5; lenses are dragged down in proportion to count x severity x pervasiveness.

| Lens | Score | Reason (drag findings) |
|------|-------|------------------------|
| **correctness** | **3** | Most-loaded lens: 4 findings incl. 2 medium — F-001 (duplicate heading id collision making a docs section unreachable) and F-018 (docs-sync cache fingerprint omits `extraRootPages`, silently skipping a needed re-sync), plus F-013/F-014 misleading registry examples. |
| **tests** | **3** | 4 findings (1 medium, 3 low): F-002 (TOC observer-refresh path untested), F-003 (h3-depth + dedupe branches untested), F-004 (keys hook-doc example collectors are UI-only), F-010 (`findPageNeighbors` separator/folder skip unasserted). |
| **errors** | **4** | 2 findings: F-007 (medium — `use-key-scoped` example never fires under its own instructions, missing `allowInInput`) and F-015 (low — destructive `initialFocus` example contradicts its page's a11y guidance). |
| **conventions** | **4** | 3 findings: F-017 (medium — sidebar component-docs props/notes not updated in lockstep with the new `terminal` variant), F-008 (low — bare untyped `ref` member), F-016 (low — two MDX pages lost their `description:` frontmatter). |
| **slop** | **4** | 2 findings: F-005 (low — dead `key` field on `TocEntry` forcing builder divergence + needless remount), F-011 (info — self-contradicting comment in `use-focus-restore-fallback`). |
| **dry** | **4** | 1 low: F-012 (`splatFromUrl` / route-splat derivation re-coded across new sites; needs one shared helper beside `docsPath`). |
| **types** | **4** | 1 info: F-006 (lying type guard in `Steps` — `isValidElement<StepProps>` without `child.type === Step`). |
| **simplicity** | **4** | 1 info: F-009 (`use-scroll-lock.mdx` states the refcounting fact three times on one page). |
| **structure** | **5** | No confirmed findings; survived both waves (R-013/R-015 structural candidates refuted). |
| **architecture** | **5** | No confirmed findings; survived both waves. |
| **dead-code** | **5** | No confirmed findings (R-021 dead-class candidate refuted as pre-existing/intentional). |
| **performance** | **5** | No confirmed findings (R-012 micro-redundancy candidate refuted as churn). |
| **stack** | **5** | No confirmed findings (R-008/R-012 stack candidates refuted). |
| **security** | **5** | No confirmed findings; two dedicated security-surface auditors in Round 1 found nothing. |
| **hygiene** | **5** | No confirmed findings; committed handoff JSON / generated-artifact policy respected. |

**Aggregate:** correctness 3, tests 3, errors 4, conventions 4, slop 4, dry 4, types 4, simplicity 4; structure/architecture/dead-code/performance/stack/security/hygiene 5.

**Target after fix execution:** 5/5 in every category. Every one of the 18 findings (including all 3 info) maps to at least one task in `fix-spec.md`.

## Artifact paths

- `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/findings.md`
- `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/rounds.md`
- `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/context.md`
- `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/quality-bar.md`
- `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/report.md`
- `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-03-changed/fix-spec.md`
