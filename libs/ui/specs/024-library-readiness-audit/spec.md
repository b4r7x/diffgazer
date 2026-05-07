# @diffgazer/ui Library Readiness Re-Audit

Date: 2026-05-06

Scope:

- UI package: `libs/ui`
- Keys package: `libs/keys`
- Installer CLI: `cli/add`
- Repo docs, generated registry artifacts, and consumer smoke scripts where relevant

This was a read-only audit. Public npm publication and hosted registry deployment are treated as future-gated product work, not blockers by themselves. Anything that breaks local tarball, package-mode, copy-first, shadcn-style local registry, or current docs handoff is counted.

## Verdict

Not 5/5 SOTA yet.

Package-mode imports are close to handoff-ready, but copy-first registry closure has P0 breakage. Component quality is materially improved, especially React 19 effect/ref usage, but several user-facing quality issues remain in Select, form accessibility, ID generation, and overlay/display edge cases.

Current scores from 20 agents:

- Component quality: 3.4/5 average
- User handoff readiness: 3.3/5 average

## Agent Scorecard

Batch A - Component Quality:

- React 19 hooks/effects/refs/controlled state: 4/5
- Accessibility semantics against WAI-ARIA/APG: 3/5
- Component API consistency and DX: 3/5
- Form controls: 3/5
- Overlays: 4/5
- Navigation/data: 4/5
- Display primitives: 3/5
- Tests and behavior coverage: 4/5
- TypeScript/source maintainability and public exports: 3/5
- Cross-cutting clean-code, DRY, and anti-slop: 3/5

Batch B - User Handoff Readiness:

- Registry/shadcn installability and namespace resolution: 2/5
- Installer CLI flows: 3/5
- npm package exports, sideEffects, peer deps, client directives, declarations: 4/5
- Tailwind v4, CSS, theme, @source, component CSS aggregation: 3/5
- Docs/getting-started/examples install correctness: 3/5
- Release/CI/versioning/package metadata/governance: 4/5
- Consumer compatibility: 3/5
- Dependency policy and bundle/runtime surface: 4/5
- Artifact generation and validation pipeline: 4/5
- Overall product positioning: 3/5

## React 19 / Ref / Effect Result

No ref-based rerender prevention pattern was found in production UI/keys code. `useRef` is used for DOM nodes, timers, observer/rAF scheduling, provider registries, callback maps, or non-visual mutable bookkeeping. `useEffectEvent` usage is generally aligned with React 19 guidance for effect-local latest-value callbacks in `use-outside-click`, `use-active-heading`, `use-overflow-items`, and `use-key`.

The main React-state quality issue is not a ref hack. It is falsy-string state semantics: `""` is treated as no value in navigation/select paths. One smaller React purity issue remains in avatar image status, where source-change state reset happens during render.

## Verification Performed

- `pnpm run verify` passed in this audit run.
- Normal smoke in `pnpm run verify` skipped Next consumer checks when local Next/PostCSS deps were absent.
- `validate:artifacts` passed, which confirms artifact parity but also proves it does not catch source-copy registry closure.
- Local registry count check: UI registry has 63 items: 45 UI, 9 hooks, 8 libs, 1 theme. Keys registry has 3 hooks.
- Manual inspection confirmed `public/r/*.json` misses required dependencies for `toast`, `toggle-group`, `select`, and hidden `dialog-shell`.

## SOTA References Used

- React: https://react.dev/reference/react/useEffectEvent
- React refs: https://react.dev/reference/react/useRef
- Next.js `use client`: https://nextjs.org/docs/app/api-reference/directives/use-client
- Tailwind CSS v4 source detection: https://tailwindcss.com/docs/detecting-classes-in-source-files
- shadcn registry docs: https://ui.shadcn.com/docs/registry
- WAI-ARIA APG patterns: https://www.w3.org/WAI/ARIA/apg/patterns/

## Issues

P0:

- [RDY-001: Copy-first registry dependency closure is incomplete](issues/RDY-001-copy-first-registry-closure.md)
- [RDY-002: CLI remove can delete copied keys hooks still required by retained UI](issues/RDY-002-copy-mode-remove-retained-hooks.md)

P1:

- [RDY-003: Install docs still expose unavailable public commands without local-tarball context](issues/RDY-003-install-docs-public-command-gating.md)
- [RDY-004: Canonical CSS story is inconsistent across docs, artifacts, and runtime package](issues/RDY-004-css-canonical-styles-contract.md)
- [QLT-001: Default Select dropdown can close before portalled option selection](issues/QLT-001-select-portalled-outside-click.md)
- [QLT-002: Empty string values are treated as no value in navigation and Select](issues/QLT-002-empty-string-value-semantics.md)
- [QLT-003: Custom form controls have split accessibility and native validity ownership](issues/QLT-003-form-control-a11y-validity.md)
- [QLT-004: Value-derived IDs can break ARIA relationships](issues/QLT-004-value-derived-idrefs.md)

P2:

- [RDY-005: Consumer compatibility matrix and strict smoke gates need broader proof](issues/RDY-005-consumer-compatibility-matrix.md)
- [RDY-006: Package surface and optional dependency policy need polish](issues/RDY-006-package-surface-dependency-policy.md)
- [QLT-005: Component API and composition contracts are inconsistent](issues/QLT-005-component-api-consistency.md)
- [QLT-006: Overlay dismissal and browser API resilience need hardening](issues/QLT-006-overlay-resilience.md)
- [QLT-007: Display and navigation primitives have edge-case behavior gaps](issues/QLT-007-display-navigation-edge-cases.md)
- [QLT-008: Test and maintainability confidence gaps remain](issues/QLT-008-tests-maintainability.md)

