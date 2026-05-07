# Audit 023 Issues

This folder contains the deduplicated findings from the 2026-05-06 read-only SOTA audit rerun.

Priority meaning:

- `P0`: public install or package import breaks.
- `P1`: user-facing API, docs, release, or handoff contract is inconsistent.
- `P2`: quality hardening or confidence gap.

Public npm and hosted registry deployment is intentionally deferred. `RDY-001` tracks that future deployment gate and is not counted as a current implementation blocker.

## RDY Issues

| Issue | Priority | Status |
| --- | --- | --- |
| [RDY-001: Public Distribution Endpoints Are Deferred Until Deployment](RDY-001-public-distribution-deferred.md) | Deferred | Future deployment gate |
| [RDY-002: CLI Package-Mode Diff And Init Rollback Are Not Handoff-Safe](RDY-002-cli-diff-init-safety.md) | P1 | Open |
| [RDY-003: Docs Install Handoff Is Still Inconsistent](RDY-003-docs-install-correctness.md) | P1 | Open |
| [RDY-004: Tailwind CSS Contract Needs One Canonical Component Entry](RDY-004-tailwind-css-contract.md) | P1 | Open |
| [RDY-005: Release And CI Gates Are Not Clean](RDY-005-release-ci-gates.md) | P1 | Open |
| [RDY-006: Consumer Compatibility Matrix Is Not Proven](RDY-006-consumer-compatibility-matrix.md) | P1 | Open |
| [RDY-007: npm Runtime Package Surface Is Too Large](RDY-007-package-runtime-surface.md) | P1 | Open |
| [RDY-008: Public Export Contract Exposes Hidden Internals](RDY-008-public-export-contract.md) | P1 | Open |
| [RDY-009: Artifact And shadcn Validation Need Stronger Release Gates](RDY-009-artifact-shadcn-validation.md) | P2 | Open |

## QLT Issues

| Issue | Priority | Status |
| --- | --- | --- |
| [QLT-001: React Render-Phase Ref Write Remains In useKey](QLT-001-react-ref-effect-purity.md) | P2 | Open |
| [QLT-002: Form Control Validity And Required Semantics Are Not SOTA](QLT-002-form-control-semantics.md) | P2 | Open |
| [QLT-003: Select And ToggleGroup APG Semantics Need Rework](QLT-003-select-toggle-apg.md) | P2 | Open |
| [QLT-004: Overlay And Composite A11y Semantics Need Hardening](QLT-004-overlay-a11y-semantics.md) | P2 | Open |
| [QLT-005: Component API And DX Consistency Needs Cleanup](QLT-005-api-dx-consistency.md) | P2 | Open |
| [QLT-006: Navigation, DiffView, And Large Diff Behavior Need Hardening](QLT-006-navigation-diff-performance.md) | P2 | Open |
| [QLT-007: Shared Navigation And Typeahead Logic Still Duplicates Behavior](QLT-007-dry-shared-behavior.md) | P2 | Open |
| [QLT-008: Display Primitive Contracts Need Cleanup](QLT-008-display-primitives.md) | P2 | Open |
| [QLT-009: Behavior Coverage Still Has Important Gaps](QLT-009-test-coverage-gaps.md) | P2 | Open |

