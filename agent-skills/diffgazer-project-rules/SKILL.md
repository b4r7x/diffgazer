---
name: diffgazer-project-rules
description: Use for any work inside the Diffgazer workspace, especially keys/ui extraction, web adoption, registry/CLI handoff, React changes, audits, SOTA work, or release verification. Loads the project rules and enforces code-audit, anti-slop, SOTA, SOTA-verify, and React senior guidance workflows.
---

# Diffgazer Project Rules

## Load First

1. Read `AGENTS.md` from the repository root.
2. If changing React code, load `react-senior-guide` and the relevant subskills:
   - `react-useeffect` for effects and synchronization.
   - `react-useref` for refs, stale closures, and non-render state.
   - `react-anti-patterns` for review.
   - `react-design-patterns` for component extraction decisions.
3. If auditing or reviewing, load `code-audit`, `anti-slop`, `clean-code`, and `code-quality`.
4. If the task says SOTA, best practices, handoff-ready, or release-ready, load `sota`.
5. After implementation of a spec, public API, registry/CLI, or multi-package change, run a `sota-verify` style loop until clean.

If a named skill is unavailable in the current agent, say so and manually apply the same checklist.

## Non-Negotiable Boundaries

- `libs/keys` owns reusable keyboard-first behavior: scopes, key registration, navigation, focus zones, focus trap/restore, focusable/tabbable utilities, scroll lock, and keyboard/focus helpers.
- `libs/ui` owns reusable shadcn-like UI primitives, compound components, form primitives, public UI hooks, CSS/source contracts, examples, docs, and registry entries.
- `apps/web` owns Diffgazer product composition, domain flows, copy, app-specific layout, and data wiring.
- `libs/registry` owns shared registry schemas/build/validation/copy helpers.
- `cli/add` owns user-facing registry commands and install/remove/diff/list behavior.

Extract primitives, not product widgets. Reuse `libs/ui` and `libs/keys` in web; do not duplicate roving focus, focus trap, Field wiring, or generic list navigation in the app.

## Implementation Checklist

- Start with `git status --short`.
- Inspect nearby files and tests before editing.
- Use `rg` / `rg --files` for search.
- Use `apply_patch` for manual edits.
- Preserve unrelated dirty worktree changes.
- Keep public UI API names consistent:
  - value state: `value`, `defaultValue`, `onChange(value)`.
  - native wrappers keep native events.
  - semantic state: `open/onOpenChange`, `highlighted/onHighlightChange`, `selectedId/onSelect`, `onNavigate`.
- Do not add deprecated aliases before the first public release.
- For React, derive instead of syncing state, use events for actions, effects for external synchronization, refs for non-render mutable state, and avoid defensive memoization.
- Avoid nested ternaries, long `??` chains, vague callback names, one-off abstractions, dead compatibility code, and AI-style comments.

## Handoff Checklist

For every public library or registry change:

- Update source registry files.
- Update public registry JSON under `libs/ui/public/r` or `libs/keys/public/r`.
- Update docs and examples.
- Update generated bundles through `pnpm run prepare:artifacts` when needed.
- Verify direct copy, `dgadd`, and npm package paths still work.
- Ensure public UI copy-mode source does not import `@diffgazer/keys` directly.
- Ensure public keys copy source does not emit relative `.js` import specifiers.

## Verification Checklist

Choose the narrowest relevant checks first, then broader gates:

- Keys changes: focused keys tests + `pnpm --filter @diffgazer/keys type-check`.
- UI changes: focused UI tests + `pnpm --filter @diffgazer/ui type-check`.
- Web changes: focused web tests + `pnpm --filter @diffgazer/web type-check`.
- Registry/CLI/handoff changes: `pnpm run prepare:artifacts` + `pnpm run validate:artifacts:check`.
- SOTA/release-ready final gate:
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
  - `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
  - `pnpm run verify:monorepo`
  - `git diff --check`

Do not claim ready/SOTA if any required gate failed, was skipped unexpectedly, or was not run.

## Subagent Prompt Prefix

Use this prefix for delegated implementation or audit agents:

```text
You are working in /Users/voitz/Projects/diffgazer-workspace.
Before acting, read AGENTS.md and load/apply these skills if available:
code-audit, anti-slop, clean-code, code-quality, sota, sota-verify, react-senior-guide, react-useeffect, react-useref, react-anti-patterns, react-design-patterns.

Respect the repo boundaries:
- libs/keys = reusable keyboard/focus primitives.
- libs/ui = shadcn-like reusable UI primitives.
- apps/web = product composition only.
- libs/registry and cli/add = handoff contracts.

Do not revert unrelated worktree changes. Use behavior/accessibility tests. Update docs/registry/public artifacts when public APIs or handoff behavior changes. Verify with the relevant commands and report exact results.
```
