# Diffgazer Structure Audit — Final Report

scope: full monorepo (structure lenses only) · date: 2026-06-04 → 2026-06-05 · status: CONVERGED

Repo: `/Users/voitz/Projects/diffgazer-workspace` (pnpm@10.28.2 + Turborepo 2.9.x TS monorepo, ESM, Biome-only).
Ledger: **258 confirmed** findings, **97 rejected**, 110 duplicates collapsed. Binding doctrine: `sota-structure` SKILL
+ owner decisions D1–D8 (`decisions.md`) + repo contract `AGENTS.md`.

> Count note: the orchestration brief carried a pre-final snapshot of "257 confirmed / 96 rejected". The
> authoritative ledger total after the last drain round is **258 confirmed** (F-001..F-258, contiguous, no gaps)
> and **97 rejected**. The per-round `confirmed-new` column sums to exactly 258; the report uses the ledger figure.

---

## 1. Run summary

### Rounds trail (from `rounds.md`)

| Round | Finders | Failed | Candidates | Confirmed-new | Duplicates | Rejected | Dry |
|------:|--------:|-------:|-----------:|--------------:|-----------:|---------:|----:|
| 1  | 25 | 0 | 162 | 103 | 43 | 16 | 0 |
| 2  | 15 | 0 | 67  | 38  | 25 | 4  | 0 |
| 3  | 12 | 0 | 54  | 10  | 2  | 3  | 0 |
| 4  | 15 | 0 | 49  | 23  | 10 | 16 | 0 |
| 5  | 14 | 7 | 18  | 8   | 3  | 7  | 0 |
| 6  | 11 | 0 | 26  | 14  | 6  | 6  | 0 |
| 7  | 14 | 0 | 32  | 15  | 5  | 12 | 0 |
| 8  | 11 | 0 | 12  | 3   | 4  | 5  | 0 |
| 9  | 10 | 0 | 15  | 11  | 2  | 2  | 0 |
| 10 | 11 | 0 | 16  | 8   | 2  | 6  | 0 |
| 11 | 13 | 0 | 43  | 22  | 6  | 15 | 0 |
| 12 | 5  | 0 | 6   | 2   | 1  | 3  | 0 |
| 13 | 5  | 0 | 2   | 0   | 1  | 1  | 1 |
| 14 | 4  | 0 | 1   | 1   | 0  | 0  | 0 |
| 15 | 4  | 0 | 1   | 0   | 0  | 1  | 1 |
| 16 | 4  | 0 | 0   | 0   | 0  | 0  | 2 |
| **Total** | — | — | — | **258** | **110** | **97** | — |

Yield curve: round 1 produced 103 confirmed (40% of the corpus); rounds 1–2 produced 141 (55%); rounds 1–11
produced 257 of 258 (99.6%). The tail (rounds 12–16) added a single net-new finding (round 14) across 22
finder-runs — the expected long-tail signature of a saturated pool.

### Crash incidents (environment-level, recovered without data loss)

- **After round 2** — a subagent fleet failure (environment-level, not a data fault) interrupted the wave.
  Recovered without data loss; the ledger was intact and the next round resumed cleanly.
- **After round 7** — a second environment-level subagent failure during the second run. Recovered without
  data loss. The two interrupted rounds of that run (logged as rounds 8–9 of the second run) were **vacuous
  and discarded**; the rounds.md trail above is the reconciled, authoritative sequence after discarding them.

Both incidents were infrastructure failures of the runner, not corruption of the findings ledger. No confirmed
finding was lost or double-counted across either recovery (verified by the contiguous F-001..F-258 numbering and
the confirmed-new column summing to 258).

### Convergence status: CONVERGED

The pool is drained. Convergence criterion met: **round 13 was genuinely dry** (0 confirmed-new, dry counter
incremented) and the final rounds (15: dry, 16: two dry passes, 0 candidates) reproduced dryness with **zero
finder failures** — i.e. the dryness is real signal, not masked by crashed finders. Round 16 surfaced 0
candidates from 4 healthy finders. The audit is converged; no further drain rounds are warranted.

---

## 2. Spec status

**Completeness review: PASSED.**

- `fix-spec.md` is a single self-contained handoff: executor context (D1–D8 + AGENTS.md boundaries +
  sota-structure doctrine + verbatim gates), an 8-phase subagent-driven execution protocol, and a Coverage map.
- **Coverage:** every confirmed finding **F-001 through F-258 is assigned to at least one task** (T-101..T-818).
  Distinct F-ids covered = 258, contiguous, no gaps. F-ids the assembler had to patch in = **0** (the phase spec
  already assigned every finding). F-049 is correctly split across two tasks (T-160 select half, T-161 logo half);
  both halves covered.
- **Phase shape (gated, staged per D7):** Phase 1 pure moves/renames (zero logic, ts-morph, renders as `git -M`
  renames) → Phase 2 DRY extractions + architecture/boundary fixes → Phase 3 barrel dissolution (D6) → Phase 4
  splits + local SRP/dead-code/slop → Phase 5 docs-mirror removal (D5) + docs build rework → Phase 6 dependency
  hygiene → Phase 7 enforcement wiring (dependency-cruiser, knip, Biome filename-case, barrel-ban lint) + test
  moves → Phase 8 hygiene & docs. Each phase carries its own exit-gate block; serialization notes (1.O→1.F/1.K→1.G,
  5.B-after-5.A, 7.G-after-7.A/7.F) are explicit so the orchestrator only parallel-dispatches file-disjoint batches.
- Every phase exit and the final acceptance step pin the verbatim SOTA gate set (`turbo run type-check`,
  full `turbo run test`, `prepare:artifacts` + `validate:artifacts:check`, strict-skips `smoke`, `verify:monorepo`,
  `git diff --check`) plus a final full-sweep re-audit wave.

The spec is executable end-to-end by an executor with no prior context and leaves no finding unassigned.

---

## 3. Scorecard (CURRENT codebase state, pre-execution)

Scored 1 (systemic, many/severe findings) to 5 (SOTA, clean). Target after executing `fix-spec.md` = **5/5 on
every lens**. The current state reflects 258 open findings before any fix is applied.

| Lens | Score | One-line justification |
|------|:-----:|------------------------|
| **structure** | 3 | 32 findings: `libs/ui/src/` is a misleading runtime shell holding only build-time validators (F-010), misplaced modules and non-boundary `index.ts` orchestrators; the underlying per-workspace taxonomy is sound, so this is corrective not foundational. |
| **naming** | 2 | Largest lens (65): pervasive path-echo (`features/review/hooks/use-review-*`), `<unit>-name` repetition in compound folders, the lone PascalCase `App.tsx`, banned grab-bag `utils.ts`, and dot-segment names. Mechanical but broad; 25% of basenames exceed the ≤1-hyphen target. |
| **dry** | 3 | 22 findings incl. a byte-for-byte `registryItemToDistKey()` duplication across tsup + build-declarations (F-011) and `apps/web` reimplementing the shared `useWizardState` machine (F-104). Real duplication, but localized to identifiable seams. |
| **simplicity** | 4 | No dedicated `simplicity` lens fired; complexity issues fold into structure/dry/dead-code. The small-file culture (median 50.5 LOC, no hand-written `.ts/.tsx` > 417 lines) keeps per-file complexity low. Deductions are the few over-orchestrated barrels/shells, not sprawling files. |
| **dead-code** | 2 | 34 findings: fully orphaned modules shipped into the public registry handoff (`lib/focus.ts` F-008, `resolve-tab-target.ts` F-009), a dead `useKey` + its entire scoped-dispatch infra (F-005), dead exports (F-006), orphaned components (F-143 `storage-wizard.tsx`), and a `vitest`-importing helper leaking into the published `@diffgazer/core` tarball. |
| **barrels** | 2 | 14 findings but high blast radius: `libs/core` imports its own package through subpath `exports` **95 times** (F-007, forbidden self-barrel), plus ~15 dead/bypassed internal `apps/web` re-export barrels (F-001) and self-barrel imports in `cli/server` and `libs/registry`. D6 mandates removing all of them. |
| **tests** | 3 | 22 findings: `apps/web` re-tests an upstream `@diffgazer/keys` contract through a synthetic fixture (F-002), 8 packages ship dead `test:types` wiring for non-existent type tests, plus dot-segment test-name issues. Colocation house style itself is correct and kept. |
| **architecture** | 3 | 11 findings (architecture + boundaries): a shared-tier middleware importing a feature service (F-012, wrong-direction), the docs mirror coupling (F-003), and the browser SPA pulling the Node-only eager figlet renderer into the web bundle (F-215). Boundaries are documented and mostly honored; these are targeted leaks. |
| **dependency-hygiene** | 2 | Undeclared phantom test-tooling deps in 5 workspaces with version drift (F-226), `@diffgazer/ui` declaring `@diffgazer/keys` an *optional* peer while two shipped exports statically import it (F-234), `@diffgazer/keys` shipping 5 subpath exports that contradict its README/invariants (F-105), and dead/version-drifted deps across most manifests. No enforcement tool installed yet. |
| **repo-hygiene** | 2 | 36 hygiene findings: three stale committed mega-audit dumps at root (`AUDIT_/OPUS_AUDIT_/FIX_SPEC_2026-05-24.md`), stale `specs/archive/` + dated `audits/` + `agent-specs/`, Biome lint covering only 1 of 10 workspaces (F-013), and config/README drift. D8 mandates the deletions. |
| **mirror** | 1 | The single biggest structural issue: `apps/docs/registry/` is a **642-file** mirror of `libs/ui` consumed via `@/components/ui` instead of `@diffgazer/ui` directly (F-003), violating AGENTS.md and D5. 7 mirror findings, incl. the un-enumerated `apps/docs/styles/` materialization facet (F-144). D5 mandates full removal; verified 1:1 feasible. |

**Lenses that cannot reach a clean 5/5 by execution alone:** none of the *codebase* lenses are blocked — every
finding is assigned and fixable in-tree. The only lens whose ceiling depends on something beyond a one-time edit is
**repo-hygiene/dependency-hygiene durability**: reaching and *holding* 5/5 requires the Phase-7 enforcement wiring
(dependency-cruiser layer/no-circular/no-orphans + knip dead-code + Biome filename-case + the self-barrel-import
lint ban) to land and stay green; knip is staged as a non-blocking report initially (expected false positives on
workspace path aliases), so its lens hits a *durable* 5/5 only once the staged warnings are promoted to errors.
All other lenses reach 5/5 on execution completion.

---

## 4. Top 10 highest-impact findings

1. **F-003 (high · mirror/architecture)** — `apps/docs` consumes the **642-file** `apps/docs/registry/` mirror via `@/components/ui` instead of `@diffgazer/ui` directly; D5 removal verified 1:1 feasible. Largest single structural cleanup in the repo.
2. **F-007 (high · barrels)** — `libs/core` imports its own package through subpath `exports` **95 times** across 58 files (forbidden self-barrel; package compiles against its own `dist`). Rewrite to relative + lint-ban to prevent regression.
3. **F-013 (high · repo-hygiene)** — Biome lint covers only `apps/docs` + `scripts/monorepo`; **9 of 10 workspaces are never linted**, so naming/structure enforcement is effectively off across the repo.
4. **F-001 (high · barrels)** — ~15 internal re-export barrels throughout `apps/web` (D6 violations); most are already dead or bypassed by concrete imports — inconsistent and removable.
5. **F-234 (high · dependency-hygiene)** — `@diffgazer/ui` marks `@diffgazer/keys` an **optional** peer, but two shipped package exports statically import it — a governance + README self-contradiction that breaks consumers who skip the optional peer.
6. **F-215 (high · architecture)** — The browser SPA (`apps/web`) imports the Node-only eager figlet renderer `@diffgazer/core/get-figlet`, bundling figlet+Big.js into the web bundle against governance, with figlet undeclared as an `apps/web` dependency.
7. **F-008 / F-009 (high · dead-code)** — `lib/focus.ts` and `lib/resolve-tab-target.ts` are fully orphaned modules (zero production importers, superseded by `selectable-collection`) yet ship into the committed public `public/r` registry handoff and are advertised in docs.
8. **F-104 (high · dry)** — `apps/web`'s `useOnboarding` + `onboarding-reducer` reimplement the shared `libs/core` `useWizardState` state machine that the TUI already consumes; converge on the shared machine.
9. **F-226 (high · dependency-hygiene)** — The test runner (vitest) and DOM/RTL tooling are **undeclared phantom dependencies in 5 workspaces** with version drift across the rest; tests pass only via hoisting luck.
10. **F-005 (high · dead-code)** — Dead `useKey` hook (zero importers) plus its entire scoped-handler dispatch infrastructure in the TUI keyboard provider (the `scopesRef` registry + dispatch branch never fire).

---

## 5. Out of scope

This was a **structure-scoped audit** per owner instruction. The following lenses were deliberately **NOT run**
and carry no findings here:

- **Correctness** (logic bugs, runtime behavior, edge cases).
- **Security** (OWASP/auth/secret-handling/input-validation review).

No claim is made about correctness or security posture. A separate correctness/security pass is required before any
release sign-off; the green structure gates here do not substitute for it.

---

## 6. Artifact index — `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-04-structure`

| Path | Purpose |
|------|---------|
| `context.md` | Project + stack snapshot, scope inventory, intentional conventions (do-not-flag list), verbatim gates, SOTA quality bar. The brief every finder received. |
| `decisions.md` | Owner decisions **D1–D8** (binding) + enforcement + quality bar. Overrides where explicit. |
| `findings.md` | The ledger: 258 confirmed findings (evidence + fix per F-id). **status line edited to `converged`** by this report step. |
| `digest.txt` | One-line-per-finding handled-list (dedupe key for finders — never re-report). |
| `rounds.md` | Per-round wave log (rounds 1–16, confirmed-per-round, finder failures, dry counter). |
| `fix-spec.md` | The executable 8-phase handoff: executor context, protocol, inlined tasks T-101..T-818, full F→T coverage map (258/258, 0 patched-in). |
| `spec-plan.md` | Planning notes that shaped the phase decomposition. |
| `spec/` | The per-phase source specs (`phase-1.md` .. `phase-8.md`) inlined verbatim into `fix-spec.md`. |
| `research.md` + `research/` | The 12 research notes underpinning the SOTA quality bar (naming, barrels, test placement, monorepo grouping, etc.). |
| `recon/` | `inventory.md`, `stats.md`, `conventions.md` — the raw recon feeding `context.md`. |
| `report.md` | This file. |

---

## 7. Verdict

The structure audit is **converged**: the finding pool is drained (rounds 13/15/16 dry with zero finder failures),
the 258-finding ledger is complete and contiguous, and `fix-spec.md` is a completeness-verified, fully-assigned,
gated execution plan. Current structure-lens state averages low (mirror 1, several lenses at 2) because the findings
are real and broad; **all are assigned and fixable in-tree**, with a 5/5-on-execution target on every lens once the
8 phases (and the Phase-7 enforcement wiring) land green. Correctness and security were out of scope and remain
un-audited.
