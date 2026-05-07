# P1-006: Final contract closure blockers remain after 10x3 re-audit

Area: React lifecycle / accessibility / docs / component contracts / release governance
Severity: P1
Effort: Medium/Large

## Problem

The first implementation batch fixed the original installability and several runtime blockers, but the 10x3 re-audit found remaining contradictions that prevent a credible SOTA 5/5 handoff.

## Evidence

- `usePresence` performs render-phase state sync in `libs/ui/registry/hooks/use-presence.ts`.
- Dialog still uses mounted-title ref state to affect render output in `libs/ui/registry/ui/dialog/dialog-content.tsx`.
- Select required invalid state is not visibly owned by the trigger/search after native invalid events.
- Select and CommandPalette controlled active-descendant paths can point at filtered, disabled, removed, or unknown items.
- Radio required semantics are applied to individual `role="radio"` items instead of only the group.
- `libs/ui/docs/content/patterns/compound-components.mdx` still promises broad wrapper depth.
- Public examples still use deprecated props such as `selectedId`, `onSelectedIdChange`, and `onChange`.
- `StepperTrigger` can emit `aria-controls` for steps without a rendered panel.
- Tabs can recursively collect nested tab triggers from child `Tabs` instances.
- `KeyValue` horizontal/bordered layout does not match the docs.
- Policy files are untracked while listed in package `files`.
- `@diffgazer/ui` package lifecycle invokes network-enabled smoke from `prepublishOnly`.

## User Impact

Users can copy stale APIs, hit invalid ARIA or dangling IDREFs, rely on docs that overpromise composition, or publish from a clean checkout that does not contain package files referenced by manifests. The current code also fails the user's explicit React purity bar.

## Fix

Run Batch D:

- Fix React/form/IDREF issues without broad rewrites.
- Rewrite docs/examples to describe the actual contract.
- Fix the small component contract defects.
- Fix release governance and final gates.

## Acceptance Criteria

- No render-phase state sync remains in `usePresence`, or a documented project-level exception is accepted before final handoff. For this pass, prefer removing it.
- Dialog title naming no longer reads mutable refs during render.
- Required Select/Radio validation works with and without `name`, focuses visible controls, and does not submit unnamed mirrors.
- Emitted `aria-activedescendant` values always resolve to mounted, enabled, visible options.
- No public docs promise unsupported deep wrapper composition.
- Public examples use preferred current props.
- Stepper, Tabs, and KeyValue match their public contracts.
- Package policy files are tracked or removed from package `files`.
- Package lifecycle scripts are deterministic and do not invoke hidden network smoke.

## Verification

- Focused UI tests for affected components and hooks.
- Docs/static checks for stale wrapper claims, deprecated example props, command gating, and theme token drift.
- `pnpm --filter @diffgazer/ui validate:registry`.
- `pnpm run validate:artifacts`.
- `pnpm changeset status --since=main`.
- `pnpm run verify`.
- Strict smoke with `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1`.

