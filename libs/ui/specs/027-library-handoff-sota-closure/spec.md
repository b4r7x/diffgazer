# Library Handoff SOTA Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

Date: 2026-05-10

**Goal:** Close the remaining `@diffgazer/keys`, `@diffgazer/ui`, `apps/web`, CLI, registry, and docs blockers so the reusable libraries are genuinely handoff-ready and verifiably SOTA 5/5.

**Architecture:** Fix the reusable foundations first, then harden UI primitives, then migrate web usage away from local reimplementations. Do not extract product workflows into libraries. Final verification must include a fresh `$sota-verify` loop by the executing Opus 4.7 agent.

**Tech Stack:** React 19, TypeScript, pnpm monorepo, Vitest, shadcn-like registry/copy/npm handoff, `@diffgazer/keys`, `@diffgazer/ui`, `@diffgazer/add`, `apps/web`.

---

## Planning Method

This spec uses the repository's Spec Kit-style convention under `libs/ui/specs/*` and the Superpowers workflow for execution.

Required planning/execution skills:

- `superpowers:writing-plans`
- `superpowers:dispatching-parallel-agents`
- `superpowers:subagent-driven-development`
- `superpowers:executing-plans`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

Required implementation/review skills for every Opus 4.7 subagent:

- `$sota`
- `$code-audit`
- `$sota-verify` where explicitly assigned
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `architecture`
- `typescript-expert`

Use current docs/references while implementing:

- React refs/effects: `react.dev/reference/react/useRef`, `react.dev/reference/react/useEffect`
- React 19 refs as props: `react.dev/blog/2024/12/05/react-19`
- Testing Library user-event keyboard/focus guidance
- WAI-ARIA APG keyboard, dialog, combobox, menu, listbox, tabs, radio, toolbar patterns
- shadcn registry item schema and registry dependency semantics

## Ground Rules

- Agents are not alone in the codebase. Do not revert user edits or other-agent edits.
- No deprecated aliases before first customer-facing release. Rename public APIs and update all consumers/docs/tests/registry/public artifacts.
- Public value controls use `value`, `defaultValue`, and `onChange(value)`.
- Native wrappers that render native form elements keep native React event handlers, for example `Input onChange(event)` and `Textarea onChange(event)`.
- Non-value state uses semantic names: `open/onOpenChange`, `highlighted/onHighlightChange`, `selectedId/onSelect`, `onNavigate`.
- `Field` owns label, control id, required, disabled, invalid, description, error, and ARIA relationships.
- `Input` is the bare native input wrapper. `InputGroup` is only a decorated shell.
- Keep product assemblies in `apps/web`: review progress, history panes, severity breakdowns, onboarding page flow, trust workflow, provider workflow, route state.
- Use TDD for behavior changes. Prefer behavior/accessibility tests over implementation assertions.
- Run `pnpm run prepare:artifacts` before artifact validation, root type-check, root tests, or release checks when generated files may be stale.

## Required Outcome

Done means all of this is true:

- `@diffgazer/keys` has correct scope registration, focus-zone target synchronization, navigation guards, focus trap/restore utilities, registry coverage, docs, and CLI ownership behavior.
- `@diffgazer/ui` public API follows repo naming rules; form/field/select composition is accessible; overlay/dialog/select/menu/listbox behavior follows APG-compatible contracts where claimed.
- `apps/web` builds from `@diffgazer/keys` and `@diffgazer/ui` primitives wherever the abstraction is reusable, while product-specific adapters remain app-local.
- Copy source, `dgadd`, and npm/package-mode handoff tell the same truth or explicitly document scoped limitations.
- Public docs, examples, generated docs data, public `/r` registry files, generated bundles, and package declarations are updated.
- The final Opus 4.7 executor runs `$sota-verify` against this spec and fixes every Critical/High/Medium/Low/Info finding until clean.

## Non-Goals

- Do not publish npm packages.
- Do not deploy hosted registry.
- Do not move `ProgressList`, `SeverityBreakdown`, `TimelineList`, `HistoryInsightsPane`, `TrustPermissionsContent`, `StorageSelectorContent`, route state, or page workflows into `libs/ui`.
- Do not move `useHistoryKeyboard`, `useReviewResultsKeyboard`, `useProvidersKeyboard`, `useModelDialogKeyboard`, `useTrustFormKeyboard`, router/back-navigation, or footer copy into `libs/keys`.
- Do not build a universal collection framework unless a focused fix proves current primitives cannot satisfy public contracts.
- Do not solve every visual polish nit before the public API/accessibility/handoff blockers.

## Issues

Keys:

- [KYS-001: Scope registration and provider ordering can assign shortcuts to the wrong scope](issues/KYS-001-scope-registration.md)
- [KYS-002: Focus zones change logical state without a reusable DOM focus target contract](issues/KYS-002-focus-zone-targets.md)
- [KYS-003: Navigation primitives have editable-target, boundary, disabled, and data-value contract gaps](issues/KYS-003-navigation-contract.md)
- [KYS-004: Focus trap, scroll lock, and focusable discovery need library-grade hardening](issues/KYS-004-focus-trap-scroll-lock.md)
- [KYS-005: Keys registry, CLI ownership, docs, and examples do not yet match the handoff contract](issues/KYS-005-registry-cli-docs.md)

UI:

- [UI-001: Public UI API naming violates repo rules in multiple primitives](issues/UI-001-public-api-contract.md)
- [UI-002: Field, Select, Input, Radio, and Checkbox form contracts are inconsistent](issues/UI-002-field-select-form.md)
- [UI-003: Dialog, Select, Popover, and overlay behavior has APG and portal blockers](issues/UI-003-overlays-select-apg.md)
- [UI-004: Listbox, Menu, Sidebar, Accordion, and typeahead navigation have nested/disabled/boundary gaps](issues/UI-004-navigation-listbox.md)
- [UI-005: Registry, package-mode, docs generation, CSS, and examples have handoff parity gaps](issues/UI-005-registry-docs-package.md)
- [UI-006: Primitive boundaries and web adoption need final cleanup without over-extracting product components](issues/UI-006-primitive-boundary-web-adoption.md)

## Agent Briefs

Run the implementation in batches. All agents use Opus 4.7.

### Batch A: Keys Foundations

These can run in parallel if their write ownership is respected:

- [Agent 01: Keys Scope and Provider Runtime](agents/01-keys-scope-provider.md)
- [Agent 02: Keys Focus Zone, Navigation, and Focusable Utilities](agents/02-keys-focus-navigation.md)
- [Agent 03: Keys Registry, CLI, Docs, and Examples](agents/03-keys-registry-cli-docs.md)

After Batch A, run:

- `pnpm --filter @diffgazer/keys test`
- `pnpm --filter @diffgazer/keys type-check`
- `pnpm --filter @diffgazer/keys validate:registry`
- `pnpm --filter @diffgazer/add test`
- `pnpm --filter @diffgazer/add type-check`

### Batch B: UI Runtime and API

These can run in parallel only if ownership stays disjoint:

- [Agent 04: UI Public API and Form Contracts](agents/04-ui-public-api-form.md)
- [Agent 05: UI Overlays, Dialog, Select, and APG Behavior](agents/05-ui-overlays-select-apg.md)
- [Agent 06: UI Navigation, Listbox, Menu, Sidebar, and Accordion](agents/06-ui-navigation-listbox.md)

After Batch B, run:

- `pnpm --filter @diffgazer/ui test`
- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/ui validate:registry`

### Batch C: Handoff and Web Adoption

Run after Batches A and B have stabilized:

- [Agent 07: Registry, Docs, Package Declarations, CSS, and Generated Artifacts](agents/07-registry-docs-package.md)
- [Agent 08: Web Primitive Adoption and Product Boundary Cleanup](agents/08-web-adoption-primitives.md)
- [Agent 09: Test Quality and Behavior Coverage](agents/09-tests-quality.md)

After Batch C, run:

- `pnpm run prepare:artifacts`
- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm --filter @diffgazer/keys validate:registry`
- `pnpm run validate:artifacts:check`
- `pnpm --filter @diffgazer/web test`
- `pnpm --filter @diffgazer/web type-check`

### Batch D: Final Verification

- [Agent 10: Final SOTA Verify and Closure](agents/10-final-sota-verify.md)

Batch D must run the final audit and fix loop. Do not claim 5/5 without fresh evidence from this batch.

## Execution Prompt

Use [execution-prompt.md](execution-prompt.md) as the exact handoff prompt for the Opus 4.7 executor.

## Baseline Verification Commands

Use narrow commands during implementation, then final gates:

```bash
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/keys validate:registry
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
pnpm run verify
git diff --check
```

Expected final status:

- All commands exit `0`.
- If `pnpm run verify` skips optional Next smoke due missing local dependencies, report the exact skip. It is not enough to hide it.
- No stale public API names remain unless explicitly approved in this spec.
- No generated deterministic docs under `libs/ui/docs/generated`, `libs/keys/docs/generated`, or `cli/add/src/generated` are committed.
- Public registries under `libs/ui/public/r` and `libs/keys/public/r` are synchronized.
