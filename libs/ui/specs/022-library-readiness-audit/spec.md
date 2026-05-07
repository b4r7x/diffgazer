# @diffgazer/ui Library Readiness Audit 022

Date: 2026-05-06

Scope:

- UI package: `libs/ui`
- Keys package: `libs/keys`
- Installer CLI: `cli/add`
- Docs, registry consumers, and generated artifacts in this repo where relevant

Verdict: not ready for public user handoff today.

Component quality is materially improved, but still has React ref/effect purity issues, accessibility contract gaps, and coverage gaps. User handoff is blocked by registry schema/installability issues, package export/RSC ambiguities, CLI path safety gaps, and Tailwind/CSS contract drift.

Note: public npm and hosted registry deployment is intentionally deferred until the deployment/publication phase. RDY-001 records the future deployment work, but it is not counted as an implementation blocker for the current code-quality/readiness pass.

## Scores

| Batch | Average | Result |
| --- | ---: | --- |
| Component quality | 3.0 / 5 | Usable in-repo, not yet clean enough for a reusable library handoff |
| User handoff readiness | 2.6 / 5 | Blocked for public install and clean consumer onboarding |

## Current Local Context

| Area | Finding |
| --- | --- |
| Package names | `@diffgazer/ui` 0.1.0, `@diffgazer/keys` 0.1.1, `@diffgazer/add` 0.1.0 |
| Package exports | `@diffgazer/ui` exposes 63 public subpath exports for components, hooks, lib, and CSS. Hidden registry items `portal` and `dialog-shell` are generated into dist but are not package-exported. |
| Registry counts | UI registry has 62 items: 45 `registry:ui`, 8 `registry:hook`, 8 `registry:lib`, 1 `registry:theme`. Keys copy bundle has 3 items. |
| Dependency conventions | UI peers: `react >=19.0.0`, `react-dom >=19.0.0`, `@diffgazer/keys >=0.1.0`. UI deps: `class-variance-authority`, `clsx`, `figlet`, `tailwind-merge`. UI has `sideEffects: ["**/*.css"]`. Keys has `sideEffects: false` and a declared `zod` dependency. |
| CLI command and package | Binary command is `dgadd` from package `@diffgazer/add`. Docs commonly show `npx @diffgazer/add@latest ...`. |
| Tailwind/CSS story | Docs instruct users to import Tailwind, add `@source`, then import `@diffgazer/ui/styles.css`. The shipped `styles.css` also imports Tailwind, which makes package-mode ordering ambiguous. |
| Docs install snippets | Docs include public npm and hosted-registry snippets. Public package and hosted registry availability were not verified as available. |
| Test/build commands | Verified: `pnpm --filter @diffgazer/ui validate:registry`, `pnpm --filter @diffgazer/ui type-check`, `pnpm --filter @diffgazer/ui test`, `node --import tsx cli/add/src/index.ts list --json`, `pnpm --filter @diffgazer/add test`. Build was not run because package builds rewrite generated artifacts. |

## Local Verification

Passed:

- `pnpm --filter @diffgazer/ui validate:registry`
- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/ui test` - 49 files, 443 tests
- `node --import tsx cli/add/src/index.ts list --json`
- `pnpm --filter @diffgazer/add test` - 38 tests

Failed external/public checks:

- `npm view @diffgazer/add version --json` returned npm `E404`
- `npm view @diffgazer/ui version --json` returned npm `E404`
- `npm view @diffgazer/keys version --json` returned npm `E404`
- `curl -I --max-time 8 https://ui.diffgazer.com/r/accordion.json` failed DNS resolution
- `curl -I --max-time 8 https://keys.diffgazer.com/r/navigation.json` failed DNS resolution

Not run:

- `pnpm --filter @diffgazer/ui build`, because this audit was read-only and the build rewrites generated artifacts.

## Reference Baseline

The audit used current official documentation as the behavioral baseline:

- React refs: refs are stable mutable cells, should not be read or written during render except safe initialization, and should not replace render state.
- React effects: effects are for external synchronization; derived state and event-specific logic should not be effect-driven.
- Tailwind v4: source detection excludes `node_modules`; reusable packages need explicit `@source` when class names live in package output.
- shadcn registry: registry items must match the supported schema and namespace/install resolution rules.
- WAI-ARIA/APG: composite widgets must keep ownership, focus, disabled, and accessible-name contracts coherent.

## Batch A - Component Quality

| Focus | Score | Summary |
| --- | ---: | --- |
| React 19 hooks/effects/refs/controlled state | 3 / 5 | Render-time ref writes, render-affecting refs, effect-derived state, and forced rerender patterns remain. |
| Accessibility semantics | 3 / 5 | Select/listbox, popover, accordion disabled state, and sidebar labelling need hardening. |
| Component API consistency and DX | 3 / 5 | Controlled prop names, handler composition, disabled anchors, root prop forwarding, and ARIA prop naming are inconsistent. |
| Form controls | 3 / 5 | Form reset, radio submission, select label state, and toggle/select event sequencing need work. |
| Overlays | 3 / 5 | Popover focus semantics, outside-click handling, and effect dependency coverage need cleanup. |
| Navigation/data | 3 / 5 | Tabs first render, useNavigation selectors, stale listbox state, and sidebar collapse semantics need hardening. |
| Display primitives | 3 / 5 | Logo/figlet contract, live-region defaults, SSR behavior, BlockBar, Spinner, Chevron, and client boundaries need cleanup. |
| Tests and behavior coverage | 3 / 5 | Stronger tests are needed for floating positioning, observers, hover popover, SSR/StrictMode, timers, and primitives. |
| TypeScript/source maintainability and public exports | 3 / 5 | Missing hidden exports, source client-boundary ambiguity, broad declarations, and `Ref<never>` casts remain. |
| Clean code, DRY, anti-slop | 3 / 5 | Main concerns are ref-as-state, forced rerenders, duplicate state, and avoidable defensive patterns. |

## Batch B - User Handoff Readiness

| Focus | Score | Summary |
| --- | ---: | --- |
| Registry/shadcn installability and namespace resolution | 2 / 5 | Public hosts fail DNS and keys registry emits unsupported schema/type patterns. |
| Installer CLI flows | 2 / 5 | Path safety, keys ownership, manifest portability, and init rollback are not handoff-safe. |
| npm package exports, side effects, peers, client directives, types | 2 / 5 | Missing exports, source RSC ambiguity, and broad declaration surfaces can break consumers. |
| Tailwind v4, CSS, theme, source, aggregation | 2 / 5 | Runtime and copy-first CSS contracts are inconsistent. |
| Docs/getting-started/examples | 3 / 5 | Several snippets are close, but Vite imports, result trees, public npx gates, and changelog content are stale. |
| Release/CI/versioning/metadata/governance | 3 / 5 | Release workflow exists, but provenance, prepublish checks, versioning, and support contracts need tightening. |
| Consumer compatibility | 3 / 5 | Vite aliases, Next detection/RSC, Windows paths, and pure server-safe item metadata need hardening. |
| Dependency policy and bundle/runtime surface | 3 / 5 | Zod mismatch, figlet surface, and copy-first dependency smoke coverage need work. |
| Artifact generation and validation | 3 / 5 | Generated artifact validation needs content parity, dist validation, integrity, and clean-tree gates. |
| Product positioning | 3 / 5 | Public package story, changelog, migration/support story, and copy-first vs runtime positioning are not yet handoff-ready. |

## Deduplicated Issue Index

Readiness issues:

- [RDY-001: Public Distribution Endpoints Are Deferred Until Deployment](issues/RDY-001-public-distribution-endpoints.md) - Deferred, not a current blocker
- [RDY-002: shadcn Registry Schema And Keys Namespace Are Not Install-Safe](issues/RDY-002-shadcn-registry-schema-keys-namespace.md) - P0
- [RDY-003: Installer CLI Path And Manifest Safety Is Incomplete](issues/RDY-003-cli-path-manifest-safety.md) - P0
- [RDY-004: Package Exports, RSC Boundaries, And Types Are Not Stable Enough](issues/RDY-004-package-exports-rsc-types.md) - P0
- [RDY-005: Tailwind And CSS Contract Is Ambiguous](issues/RDY-005-tailwind-css-contract.md) - P0
- [RDY-006: Consumer Compatibility Detection Is Too Narrow](issues/RDY-006-consumer-compatibility-detection.md) - P1
- [RDY-007: Docs Handoff Snippets Are Inconsistent](issues/RDY-007-docs-handoff-correctness.md) - P1
- [RDY-008: Release Governance And Support Contract Need Tightening](issues/RDY-008-release-governance-support.md) - P1
- [RDY-009: Artifact Validation And Smoke Coverage Are Too Weak](issues/RDY-009-artifact-validation-smoke.md) - P1
- [RDY-010: Dependency Policy And Runtime Surface Need Cleanup](issues/RDY-010-dependency-policy-runtime-surface.md) - P1

Quality issues:

- [QLT-001: React Ref And Effect Anti-Patterns Remain](issues/QLT-001-react-ref-effect-purity.md) - P2
- [QLT-002: Select And Listbox Contracts Need Rework](issues/QLT-002-select-listbox-contract.md) - P2
- [QLT-003: Navigation, Tabs, Accordion, And Sidebar Need State/A11y Hardening](issues/QLT-003-navigation-tabs-accordion-sidebar.md) - P2
- [QLT-004: Form Control APIs And Event Composition Are Inconsistent](issues/QLT-004-form-control-api-consistency.md) - P2
- [QLT-005: Overlay Semantics And Global Listener Handling Need Hardening](issues/QLT-005-overlay-semantics-listeners.md) - P2
- [QLT-006: Display Primitive Contracts Need Cleanup](issues/QLT-006-display-primitive-contracts.md) - P2
- [QLT-007: Behavior Test Coverage Has Important Gaps](issues/QLT-007-behavior-test-coverage.md) - P2
- [QLT-008: TypeScript Maintainability Has Remaining Smells](issues/QLT-008-typescript-maintainability.md) - P2

## Handoff Bar

Before user handoff:

- Public npm and registry endpoints must resolve and install in clean projects, or docs must clearly expose a local/private fallback only.
- The installer must confine writes to approved project paths, own namespace-aware manifest records, support keys removal safely, and behave consistently on Windows.
- Runtime package imports and source-copy registry installs must both be tested in clean Vite and Next App Router projects.
- Tailwind/CSS setup must have one documented import contract per integration mode.
- React ref/effect anti-patterns must be removed from core hooks and form/overlay/navigation primitives.
- Docs must match install reality exactly.
