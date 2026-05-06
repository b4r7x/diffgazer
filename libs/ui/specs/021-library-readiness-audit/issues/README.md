# Audit Issues

Prefixes:

- `RDY` - user-facing readiness: install, registry, package, CLI, docs, release.
- `QLT` - component/hook/API/test quality.

## Readiness

- [RDY-001 - Public install packages are unavailable](RDY-001-public-packages-unavailable.md) `P0`
- [RDY-002 - Theme item breaks dgadd listing and all-item flows](RDY-002-theme-breaks-dgadd-list.md) `P0`
- [RDY-003 - Registry install closure is incomplete](RDY-003-registry-closure-incomplete.md) `P0`
- [RDY-004 - Package CSS contract is broken](RDY-004-package-css-contract.md) `P0`
- [RDY-005 - @diffgazer/keys is not RSC safe](RDY-005-keys-rsc-safety.md) `P0`
- [RDY-006 - CLI ownership and path safety are insufficient](RDY-006-cli-ownership-path-safety.md) `P0`
- [RDY-007 - Component docs generated data is missing](RDY-007-component-doc-data-missing.md) `P1`
- [RDY-008 - Getting-started docs are not copy-paste valid](RDY-008-getting-started-flow.md) `P1`
- [RDY-009 - Dependency policy is split across consumption modes](RDY-009-dependency-policy.md) `P1`
- [RDY-010 - Artifact validation allows stale outputs](RDY-010-artifact-validation.md) `P1`
- [RDY-011 - Consumer verification is too narrow](RDY-011-consumer-verification.md) `P1`
- [RDY-012 - Release governance is incomplete](RDY-012-release-governance.md) `P1`
- [RDY-013 - Public product contract is inconsistent](RDY-013-product-contract.md) `P1`
- [RDY-014 - Published declarations are not strict-consumer safe](RDY-014-declaration-safety.md) `P0`
- [RDY-015 - CLI detection breaks root-source and package-manager cases](RDY-015-cli-detection-compatibility.md) `P1`
- [RDY-016 - shadcn namespace setup is incomplete](RDY-016-shadcn-namespace-docs.md) `P1`

## Quality

- [QLT-001 - Select form and listbox behavior is not robust](QLT-001-select-contract.md) `P2`
- [QLT-002 - Checkbox, radio, and toggle group semantics need hardening](QLT-002-form-group-semantics.md) `P2`
- [QLT-003 - Shared navigation has stale and incorrect state paths](QLT-003-navigation-state.md) `P2`
- [QLT-004 - Tabs can lose active state and event behavior](QLT-004-tabs-contract.md) `P2`
- [QLT-005 - Overlay lifecycle is not stack-safe](QLT-005-overlay-stack-lifecycle.md) `P2`
- [QLT-006 - ARIA/live-region details drift from APG expectations](QLT-006-aria-live-region-details.md) `P2`
- [QLT-007 - DiffView and diff computation have correctness/performance gaps](QLT-007-diff-view.md) `P2`
- [QLT-008 - Focusable hidden/unnamed regions need cleanup](QLT-008-focusable-regions.md) `P2`
- [QLT-009 - Overflow measurement and trigger semantics can go stale](QLT-009-overflow-behavior.md) `P2`
- [QLT-010 - Display primitives have robustness and bundle issues](QLT-010-display-primitives.md) `P2`
- [QLT-011 - Hook state contracts have stale update paths](QLT-011-hook-state-contracts.md) `P2`
- [QLT-012 - Public API consistency and prop forwarding are uneven](QLT-012-public-api-consistency.md) `P2`
- [QLT-013 - Test coverage misses high-risk user behavior](QLT-013-test-coverage.md) `P2`

