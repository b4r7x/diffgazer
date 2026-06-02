# Remediation Handoff — 2026-06-01 reaudit

Paste the prompt below into a fresh **Opus** session (or the orchestrating agent) to drive the full remediation.

- Plan: `audits/2026-06-01/THERMO-NUCLEAR-REMEDIATION-SPEC.md` (phases P0–P5, decisions, gates, Fixer/Validator prompts)
- Findings: `audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md` (N01–N53 with file:line, evidence, fix)

---

## Orchestrator prompt

```text
You are the orchestrator for the Diffgazer remediation in /Users/voitz/Projects/diffgazer-workspace.

Read these two files first, fully:
- audits/2026-06-01/THERMO-NUCLEAR-REMEDIATION-SPEC.md  (the plan: phases, decisions, gates, agent prompts)
- audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md           (the findings N01–N53 with file:line, evidence, fix)
Then read AGENTS.md. Run `git status --short` before anything; preserve unrelated dirty files; never revert unrelated work.

Goal: resolve every active finding (N01–N53; N02 is refuted, skip it) by executing Phases P0→P1→P2→P3→P4→P5 IN ORDER, then the Final cross-phase verification. Do not reorder or skip phases — later phases re-run gates that depend on earlier ones (P0 makes `pnpm run check` green).

For EACH phase:
1. Resolve the phase Decisions first (see the Decision register). Where a decision is a product call (F010 wire-vs-remove N10/N25/N27; N38/N53 fix-vs-remove), pick the spec's default unless told otherwise, and record the choice in the Decision register table.
2. Dispatch a Fixer (Opus) using the spec's "Fixer prompt", filled with the phase's IDs, packages, and gates. The Fixer makes scoped edits, adds BEHAVIOR tests (never implementation-detail), regenerates public registries when source changed, adds NO ticket-id comments, and runs the phase's narrow gates.
3. Dispatch a SEPARATE, fresh, UNBIASED Validator (Opus) using the spec's "Independent Validator prompt". It must NOT see the Fixer's notes. It re-derives each finding's status from the current code, runs the gates itself, scans the phase diff for regressions/new slop/weakened tests/registry drift/boundary violations, and returns per-finding verdicts + a single phase gate PASS|FAIL.
4. If FAIL: feed the Validator's worklist to a new Fixer pass, then a NEW Validator. Loop until PASS. Then update the Phase status table and advance.

Use the strongest model (Opus) for both Fixer and Validator. Fixer and Validator for the same phase MUST be different agent instances. If you have the Workflow tool, you may orchestrate phases as a pipeline (Fixer stage → Validator stage, loop-on-fail per phase); otherwise run them as sequential subagents.

After P5 passes, run the Final cross-phase verification exactly as listed (full turbo type-check/test/test:types, test:scripts, strict smoke + bench, validate:artifacts, verify:monorepo, pack dry-runs, and a re-audit of the whole diff). If the re-audit surfaces any unresolved or NEW finding, route it to its owning phase and loop that phase.

Hard rules (do not violate): keep edits within each phase's owned packages; fix root causes, never weaken/delete tests to pass a gate; keep public contracts in sync across source + docs + generated registries + package exports; do not commit generated data under */docs/generated or cli/add/src/generated; run `git diff --check` before every handoff.

Do NOT claim done if any gate fails, is skipped, or is unrun, or if any phase is left on FAIL. Final report must list: files changed, findings resolved, the F010/F018/N37/N30 decisions taken, commands run + results, commands skipped + why, remaining risks, and untracked files.
```
