# Spec 031 Task Index

Maps every active finding from `030-sota-audit-master-index/spec.md` to the implementing task brief.

## Files in this spec

- `spec.md` — master plan: phases, dependency graph, phase-gate verification, brief contract, per-task loop diagram
- `INDEX.md` — this file
- `LEADER_WORKFLOW.md` — main-context-as-thin-validator workflow (read this BEFORE dispatching agents)
- `tasks/README.md` — how subagents use the briefs (mandatory pre-read for implementers)
- `tasks/_global-context.md` — required pre-read (AGENTS.md highlights, conventions, anti-patterns)
- `tasks/_agent-guidance.md` — universal pre-flight, common pitfalls, self-check, BLOCKED criteria, command cheatsheet
- `tasks/T-<NAME>/brief.md` — one brief per implementable task (42 total)
- `_review-prompts/implementer.md` — dispatch template for implementer subagent
- `_review-prompts/spec-reviewer.md` — dispatch template for spec compliance review
- `_review-prompts/quality-reviewer.md` — dispatch template for code quality review
- `_review-prompts/fixer.md` — dispatch template for fix-loop iterations
- `_review-prompts/final-sota-verify.md` — end-of-everything verify loop (Phase 5 + iteration cap 10)

## How to dispatch

The leader (main context) follows `LEADER_WORKFLOW.md`. Per task, the dispatch sequence is:

1. **IMPLEMENTER** — copy `_review-prompts/implementer.md`, substitute `<TASK_ID>`, dispatch as fresh opus subagent.
2. **SPEC REVIEWER** — after implementer reports done, copy `_review-prompts/spec-reviewer.md`, paste implementer's report inline, dispatch.
3. If spec FAIL → **FIXER** (copy `_review-prompts/fixer.md`, paste spec issues) → re-dispatch spec reviewer. Loop, cap 5.
4. **QUALITY REVIEWER** — after spec PASS, dispatch using `_review-prompts/quality-reviewer.md`.
5. If quality REQUEST_CHANGES → FIXER → re-dispatch quality. Loop, cap 5.
6. Mark task COMPLETE in TodoWrite.

After all 42 tasks COMPLETE:

7. **FINAL SOTA VERIFIER** — dispatch using `_review-prompts/final-sota-verify.md`.
8. If DIRTY → fixers per issue → re-dispatch verifier. Loop, cap 10.
9. CLEAN → announce SOTA-ready.

See `LEADER_WORKFLOW.md` for the full state machine including phase gates.

## Finding → Task mapping

### Phase 0 (Stop-the-bleeding)
| Finding | Task |
|---|---|
| NEW-001, NEW-021 | T-VITE-ALIAS |
| NEW-038 | T-FIELD-EMPTY |
| NEW-039 | T-TABS-ZERO |
| CLI-001, CLI-002, CLI-003, NEW-018 | T-CLI-REMOVE |
| SEC-001 | T-SEC-HONO |
| GOV-001, NEW-009, NEW-010 | T-LICENSES |
| PKG-001 | T-PKG-EXPORTS |
| PKG-003 | T-PKG-ENGINES |
| NEW-022, NEW-023, NEW-024 | T-MOBILE-CRITICAL |

### Phase 1 (Handoff blockers)
| Finding | Task |
|---|---|
| REL-001 | T-PUBLISH-WF |
| DOCS-002, NEW-002, NEW-003, NEW-004 | T-DOCS-SITE |
| DOCS-001 | T-DOCS-PROPS |
| NEW-033 | T-TOAST-OVER-DIALOG |
| NEW-017 | T-THEME-CONTRACT |
| NEW-025, NEW-026, NEW-044, PKG-002 | T-BUNDLE-SLIM |
| DIST-001 | T-DIST-DEPLOY |

### Phase 2 (Library correctness)
| Finding | Task |
|---|---|
| KEYS-001 | T-FOCUS-TRAP |
| UI-001 | T-OWNER-DOC |
| NEW-029 | T-DIALOG-HYDRATE |
| NEW-040 | T-FLOAT-THROTTLE |
| UI-002, NEW-011 | T-REDUCED-MOTION |
| KEYS-002 | T-SCROLL-LOCK |
| NEW-008 | T-DIALOG-SCROLL |

### Phase 3 (Tooling)
| Finding | Task |
|---|---|
| DEP-001, NEW-012, NEW-013, NEW-014, NEW-015 | T-DEP-OVERRIDES |
| TS-001 | T-TS-ALIGN |
| SEC-002 | T-CI-HARDEN |
| NEW-031 | T-BROWSER-DOCS |
| DOCS-004 | T-DOCS-VALIDATE |

### Phase 4 (Polish + DX)
| Finding | Task |
|---|---|
| WEB-001, WEB-002, NEW-020 | T-WEB-CLEANUP |
| UI-003 | T-TYPOGRAPHY-HEADINGS |
| FP-006 | T-ACCORDION-DOCS |
| NEW-037 | T-EXAMPLES-JSDOC |
| NEW-035, NEW-036 | T-GENERICS |
| NEW-027 | T-BUTTON-LAZY |
| NEW-041 | T-PERF-PALETTE |
| UI-004, NEW-007 | T-FORM-RESET |
| I18N-001, NEW-006 | T-LOCALE-SEARCH |
| NEW-005 | T-FLOAT-PARENTS |
| NEW-034 | T-LAYERS-Z |
| NEW-016, NEW-028, ART-001, DOCS-003 | T-LOW-HYGIENE |
| NEW-042, NEW-043 | T-FIELD-CTL |

### Phase 5 (Verification / E2E)
| Finding | Task |
|---|---|
| NEW-032 | T-VISUAL-E2E |

## Coverage check

Active findings in 030 master index: 44 (NEW-001..NEW-044, minus NEW-030 dropped, minus NEW-044 merged into NEW-025) + 22 spec 028 baseline IDs (REL-001..UI-004, minus WEB-003 dropped) + 1 FP polish (FP-006) = 66 distinct active findings.

Tasks: 42. Every active finding from 030 maps to exactly one task (some tasks bundle related findings, e.g. T-LICENSES handles GOV-001+NEW-009+NEW-010, T-CLI-REMOVE handles CLI-001/002/003+NEW-018).

Dropped IDs (not in any task): WEB-003, NEW-030, FP-001 (→ART-001 wording handled by T-LOW-HYGIENE), FP-002, FP-003, FP-004, FP-005, FP-007.

## Parallelization

Tasks within the same phase that DON'T share files can run in parallel. The spec.md dependency graph shows blocking relationships. Suggested parallel batches:

**Batch 0a (truly independent, 6 agents):**
- T-VITE-ALIAS (apps/docs/vite.config.ts)
- T-FIELD-EMPTY (libs/ui/registry/ui/field/)
- T-TABS-ZERO (libs/ui/registry/ui/tabs/)
- T-PKG-EXPORTS (libs/ui/package.json — exports map)
- T-PKG-ENGINES (libs/{ui,keys}/package.json — engines)
- T-LICENSES (root + libs/{ui,keys}/LICENSE + cli/diffgazer/LICENSE + .github/)

**Batch 0b (heavier, run separately or after 0a, 3 agents):**
- T-CLI-REMOVE (cli/add + libs/registry — multi-file surgery)
- T-SEC-HONO (cli/diffgazer + libs/server package.json + lockfile)
- T-MOBILE-CRITICAL (libs/ui/registry/ui/popover + tooltip + input + dialog)

**Batch 1 (after Phase 0 verified, 7 agents):**
- T-PUBLISH-WF (needs T-LICENSES + T-BUNDLE-SLIM done first → may need to wait)
- T-DOCS-SITE (needs T-VITE-ALIAS done)
- T-DOCS-PROPS
- T-TOAST-OVER-DIALOG
- T-THEME-CONTRACT
- T-BUNDLE-SLIM
- T-DIST-DEPLOY (needs T-DOCS-SITE done if doing actual deploy)

Phases 2-5 follow same pattern. See spec.md dependency graph.
