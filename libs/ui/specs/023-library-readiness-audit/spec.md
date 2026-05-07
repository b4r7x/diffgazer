# @diffgazer/ui Library Readiness Audit 023

Date: 2026-05-06

Scope:

- UI package: `libs/ui`
- Keys package: `libs/keys`
- Installer CLI: `cli/add`
- Docs, registry consumers, generated artifacts, and package smoke scripts in this repo where relevant

Verdict: not 5/5 SOTA yet.

The current codebase is much closer to handoff than the previous audit. Local package imports, builds, docs build, artifact validation, Vite package smoke, and CLI copy-first smoke pass. Public npm and hosted registry deployment is intentionally deferred and is not counted as a current blocker.

The remaining blockers are real but narrower: one React render-phase ref write in `useKey`, custom form-control/overlay APG hardening, CLI `diff` idempotence for package integration mode, incomplete init rollback, broken Changesets release gate, skipped Next smoke coverage, empty install sections in rendered docs, and npm package surface bloat.

## Scores

| Batch | Average | Result |
| --- | ---: | --- |
| Component quality | 3.6 / 5 | Good local library candidate, not SOTA yet |
| User handoff readiness | 3.5 / 5 | Local handoff close, public release/handoff still blocked |

## Current Local Context

| Area | Finding |
| --- | --- |
| Root package | `@diffgazer/repo` |
| Package names | `@diffgazer/ui` 0.1.0, `@diffgazer/keys` 0.1.1, `@diffgazer/add` 0.1.0 |
| CLI command | Binary command is `dgadd` from package `@diffgazer/add` |
| Registry counts | UI registry has 63 items: 45 `registry:ui`, 9 `registry:hook`, 8 `registry:lib`, plus theme. Keys registry has 3 copyable hooks. |
| Dependency conventions | UI peers: `react >=19.2.0`, `react-dom >=19.2.0`, `@diffgazer/keys >=0.1.0`. UI deps include `class-variance-authority`, `clsx`, `figlet`, `tailwind-merge`. UI has `sideEffects: ["**/*.css"]`. Keys has `sideEffects: false`. |
| Tailwind/CSS story | Package mode uses Tailwind v4 `@source "../node_modules/@diffgazer/ui/dist"` plus `@import "@diffgazer/ui/styles.css"`. Copy mode uses copied `src/styles/styles.css`. One manual docs snippet still over-emphasizes `theme.css`. |
| Public distribution | Public npm and hosted registry are publish/deploy-gated future work, not a current implementation blocker. |

## Local Verification

Passed:

- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/keys type-check`
- `pnpm --filter @diffgazer/add type-check`
- `pnpm --filter @diffgazer/docs type-check`
- `pnpm --filter @diffgazer/ui test` - 66 files, 532 tests
- `pnpm --filter @diffgazer/keys test` - 11 files, 89 tests
- `pnpm --filter @diffgazer/add test` - 45 tests
- `pnpm --filter @diffgazer/ui build`
- `pnpm --filter @diffgazer/keys build`
- `pnpm --filter @diffgazer/add build`
- `pnpm --filter @diffgazer/docs build`
- `pnpm run validate:artifacts`
- `pnpm run smoke:cli`
- `pnpm run smoke:packages`

Failed or skipped:

- `pnpm changeset status --since=origin/main` fails because `.changeset/config.json` ignores `@diffgazer/keys-artifacts`, but that package is not in the workspace package set.
- `pnpm run smoke:packages` skips the Next package-mode CSS check when local `next`, `@tailwindcss/postcss`, and `postcss` deps are missing.
- `npm_config_cache=/private/tmp/npm-cache npm pack --dry-run --json` in `libs/ui` reports `entryCount: 1123` and `unpackedSize: 25,591,925`, mostly because `dist/artifacts` and private declaration staging are included in the runtime package files.

Targeted scans:

- `rg` confirms the remaining render-phase ref write at `libs/keys/src/hooks/use-key.ts:53`.
- `rg` confirms hidden form surrogates with `aria-hidden="true"` in checkbox, radio, and select controls.
- Docs scans confirm component pages still render `<InstallCommand />` under an Installation heading while the docs library has no UI installer configured.

## Reference Baseline

The audit used current official documentation as the behavioral baseline:

- React refs and purity: https://react.dev/reference/react/useRef
- React effects and cleanup: https://react.dev/reference/react/useEffect
- React layout effects: https://react.dev/reference/react/useLayoutEffect
- WAI-ARIA/APG patterns: https://www.w3.org/WAI/ARIA/apg/patterns/
- Tailwind v4 source scanning and `@source`: https://tailwindcss.com/docs/detecting-classes-in-source-files
- shadcn registry namespace/install model: https://ui.shadcn.com/docs/registry

## Batch A - Component Quality

| Focus | Score | Summary |
| --- | ---: | --- |
| React 19 hooks/effects/refs/controlled state | 4 / 5 | One clear render-phase ref trampoline remains in `useKey`; no broad ref-as-state pattern found in UI. |
| Accessibility semantics | 3 / 5 | Modal `aria-modal`, menu Tab close, composite naming, form surrogate validity, and select/toggle semantics need APG hardening. |
| Component API consistency and DX | 4 / 5 | Main gaps are selection group callback names and inconsistent root DOM prop passthrough. |
| Form controls | 3 / 5 | Custom checkbox/radio/select form validity and visible control semantics need browser-level proof. |
| Overlays | 4 / 5 | Cleanup is generally good; popover modal/non-modal focus behavior and menu autoFocus need fixes. |
| Navigation/data | 3 / 5 | DiffView markup, word-diff budget, and NavigationList click-to-keyboard continuation need work. |
| Display primitives | 4 / 5 | Callout live semantics and static primitive RSC/support story need cleanup. |
| Tests and behavior coverage | 4 / 5 | Broad test coverage exists; gaps remain in CLI keyboard installs and browser-level form/a11y flows. |
| TypeScript/source maintainability and exports | 4 / 5 | Export map resolves, but hidden registry internals are exposed as npm subpaths and export validation should be enforced. |
| Cross-cutting clean-code, DRY, anti-slop | 3 / 5 | Duplicated navigation/typeahead logic and the `useKey` ref trampoline keep this below SOTA. |

## Batch B - User Handoff Readiness

| Focus | Score | Summary |
| --- | ---: | --- |
| Registry/shadcn installability and namespace resolution | 4 / 5 | Local registry shape and namespace contracts look sound; shadcn clean-consumer smoke should be automated. |
| Installer CLI flows | 3 / 5 | Path safety is better, but package-mode `diff` and init rollback are still not handoff-safe. |
| npm package exports, sideEffects, peers, client directives, types | 4 / 5 | Package contract resolves locally; Next smoke and export/dist validation need release gating. |
| Tailwind v4, CSS, theme, source, aggregation | 4 / 5 | Runtime/copy CSS story is mostly coherent; manual docs must make `styles.css` canonical. |
| Docs/getting-started/examples | 3 / 5 | Empty component Installation sections, keys docs npx-first snippets, and broken keys API links remain. |
| Release/CI/versioning/governance | 3 / 5 | Changesets gate fails and Next smoke can skip in CI. |
| Consumer compatibility | 3 / 5 | Next RSC server-page shape, Next version detection, Vite alias detection, package managers, and keys rewrite matrix need proof. |
| Dependency policy and bundle/runtime surface | 3 / 5 | `dist/artifacts` and `figlet` inflate normal package installs. |
| Artifact generation and validation | 4 / 5 | Artifacts validate, but export target validation and shadcn smoke are not enforced directly. |
| Product positioning | 4 / 5 | Copy-first vs package mode is coherent; support/install page polish still needed. |

## Deduplicated Issue Index

Readiness issues:

- [RDY-001: Public Distribution Endpoints Are Deferred Until Deployment](issues/RDY-001-public-distribution-deferred.md) - Deferred, not a current blocker
- [RDY-002: CLI Package-Mode Diff And Init Rollback Are Not Handoff-Safe](issues/RDY-002-cli-diff-init-safety.md) - P1
- [RDY-003: Docs Install Handoff Is Still Inconsistent](issues/RDY-003-docs-install-correctness.md) - P1
- [RDY-004: Tailwind CSS Contract Needs One Canonical Component Entry](issues/RDY-004-tailwind-css-contract.md) - P1
- [RDY-005: Release And CI Gates Are Not Clean](issues/RDY-005-release-ci-gates.md) - P1
- [RDY-006: Consumer Compatibility Matrix Is Not Proven](issues/RDY-006-consumer-compatibility-matrix.md) - P1
- [RDY-007: npm Runtime Package Surface Is Too Large](issues/RDY-007-package-runtime-surface.md) - P1
- [RDY-008: Public Export Contract Exposes Hidden Internals](issues/RDY-008-public-export-contract.md) - P1
- [RDY-009: Artifact And shadcn Validation Need Stronger Release Gates](issues/RDY-009-artifact-shadcn-validation.md) - P2

Quality issues:

- [QLT-001: React Render-Phase Ref Write Remains In useKey](issues/QLT-001-react-ref-effect-purity.md) - P2, top quality gate
- [QLT-002: Form Control Validity And Required Semantics Are Not SOTA](issues/QLT-002-form-control-semantics.md) - P2
- [QLT-003: Select And ToggleGroup APG Semantics Need Rework](issues/QLT-003-select-toggle-apg.md) - P2
- [QLT-004: Overlay And Composite A11y Semantics Need Hardening](issues/QLT-004-overlay-a11y-semantics.md) - P2
- [QLT-005: Component API And DX Consistency Needs Cleanup](issues/QLT-005-api-dx-consistency.md) - P2
- [QLT-006: Navigation, DiffView, And Large Diff Behavior Need Hardening](issues/QLT-006-navigation-diff-performance.md) - P2
- [QLT-007: Shared Navigation And Typeahead Logic Still Duplicates Behavior](issues/QLT-007-dry-shared-behavior.md) - P2
- [QLT-008: Display Primitive Contracts Need Cleanup](issues/QLT-008-display-primitives.md) - P2
- [QLT-009: Behavior Coverage Still Has Important Gaps](issues/QLT-009-test-coverage-gaps.md) - P2

## Handoff Bar

To call this 5/5 SOTA:

- Remove the `useKey` render-phase ref write and prove latest-handler behavior without ref mutation during render.
- Resolve hidden native form validity/focus semantics or document and test an explicit non-native validation model.
- Make CLI `add -> diff` idempotent for `--integration keys` and make init rollback complete.
- Fix release gates so Changesets and Next package-mode smoke cannot silently fail or skip.
- Make docs render a real local/publish-gated install path or no Installation section.
- Slim the npm runtime package surface and clarify the optional `figlet` helper story.
- Add enforced clean-consumer smoke for Next App Router server pages, shadcn namespace install, and package-manager coverage.

