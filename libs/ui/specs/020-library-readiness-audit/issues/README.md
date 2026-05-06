# @diffgazer/ui Library Readiness Audit Issues

Prefixes:

- `RDY` - user-facing readiness: registry, CLI, package, docs, release.
- `QLT` - component/hook/a11y/API/test quality.

## Readiness Issues

- [RDY-001 - Bare registry dependencies need local validation](RDY-001-bare-registry-dependencies.md)
- [RDY-002 - @diffgazer/keys registry dependency contract is not safe](RDY-002-keys-registry-contract.md)
- [RDY-003 - Registry items miss npm dependency metadata](RDY-003-missing-registry-npm-dependencies.md)
- [RDY-004 - CLI command and package identity must be unambiguous](RDY-004-cli-package-command-mismatch.md)
- [RDY-005 - CLI keys integration modes can generate broken installs](RDY-005-cli-keys-integration.md)
- [RDY-006 - CLI remove and path safety need ownership metadata](RDY-006-cli-remove-path-safety.md)
- [RDY-007 - CSS can be tree-shaken from the npm package](RDY-007-css-side-effects.md)
- [RDY-008 - Tailwind v4 package scanning is undocumented and untested](RDY-008-tailwind-source-package-mode.md)
- [RDY-009 - Dialog CSS is missing from npm styles output](RDY-009-dialog-css-missing-from-npm.md)
- [RDY-010 - Client component directives are missing from npm output](RDY-010-use-client-output-mismatch.md)
- [RDY-011 - @diffgazer/keys is optional but statically imported](RDY-011-keys-optional-peer.md)
- [RDY-012 - Hidden internals are exposed as public npm API](RDY-012-hidden-internals-public-api.md)
- [RDY-013 - Public docs and README are stale or contradictory](RDY-013-docs-install-readme-drift.md)
- [RDY-014 - Release and CI gates are missing](RDY-014-release-ci-gates.md)
- [RDY-015 - Package metadata, lockfile, and version policy need release hardening](RDY-015-package-governance.md)
- [RDY-016 - Artifact validators warn instead of failing](RDY-016-artifact-validation-gaps.md)
- [RDY-017 - Canonical consumption and migration contract is missing](RDY-017-canonical-consumption-contract.md)
- [RDY-018 - Copied source assumes aliases that init does not configure](RDY-018-source-copy-alias-contract.md)

## Quality Issues

- [QLT-001 - useEffectEvent is used outside its intended React 19 role](QLT-001-use-effect-event-misuse.md)
- [QLT-002 - useControllableState has controlled undefined and updater side-effect issues](QLT-002-controllable-state-contract.md)
- [QLT-003 - composeRefs is not React 19 callback-ref-cleanup aware](QLT-003-compose-refs-cleanup.md)
- [QLT-004 - Select tags and portal outside-click behavior are broken](QLT-004-select-tags-and-outside-click.md)
- [QLT-005 - Select mixes listbox and combobox semantics](QLT-005-select-semantics.md)
- [QLT-006 - Label and checkbox group semantics do not match custom controls](QLT-006-label-checkbox-semantics.md)
- [QLT-007 - Tooltip trigger wrapper creates the wrong focus and name behavior](QLT-007-tooltip-trigger-wrapper.md)
- [QLT-008 - Sidebar uses menu roles for persistent navigation](QLT-008-sidebar-menu-roles.md)
- [QLT-009 - Tabs can start or become empty with no active tab](QLT-009-tabs-empty-active-state.md)
- [QLT-010 - Overlay lifecycle and dismissal are not stack-safe](QLT-010-overlay-lifecycle-stack.md)
- [QLT-011 - Dialog labeling, backdrop clicks, and lifecycle handlers are fragile](QLT-011-dialog-a11y-lifecycle.md)
- [QLT-012 - Radio and toggle roving tabindex and semantics are inconsistent](QLT-012-radio-toggle-roving-semantics.md)
- [QLT-013 - Stepper collapsed content is not inert](QLT-013-stepper-collapsed-content.md)
- [QLT-014 - NavigationList can keep stale active descendant ids](QLT-014-navigation-list-stale-active.md)
- [QLT-015 - DiffView keeps stale active hunk state](QLT-015-diff-view-stale-state.md)
- [QLT-016 - Overflow measurement can become stale or negative](QLT-016-overflow-measurement.md)
- [QLT-017 - Pure display primitives are unnecessarily client components](QLT-017-display-primitives-use-client.md)
- [QLT-018 - BlockBar meter values and names are not normalized](QLT-018-block-bar-normalization.md)
- [QLT-019 - Avatar fallback and accessible naming are fragile](QLT-019-avatar-fallback-accessibility.md)
- [QLT-020 - Test coverage misses high-risk behavior](QLT-020-test-coverage-gaps.md)
- [QLT-021 - Public API naming, composition, and polymorphic types are inconsistent](QLT-021-public-api-consistency.md)
- [QLT-022 - ScrollArea creates unnamed keyboard tab stops](QLT-022-scroll-area-focus-name.md)
- [QLT-023 - Breadcrumbs visually imply the current page without announcing it](QLT-023-breadcrumbs-current-page.md)
- [QLT-024 - Event handlers can replace internal component behavior](QLT-024-event-handler-composition.md)
- [QLT-025 - Navigation helper couples behavior to literal role attributes](QLT-025-navigation-helper-role-coupling.md)
