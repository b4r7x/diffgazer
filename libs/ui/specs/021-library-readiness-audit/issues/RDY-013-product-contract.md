# RDY-013 - Public product contract is inconsistent

**Area**: Positioning, docs, and migration story  
**Priority**: P1  
**Severity**: Medium/High  
**Effort**: Medium

## Problem

The public story is split between copy-first and runtime package mode without one visible support contract. Keyboard behavior is described as optional/visual-only even though some components import keyboard navigation internally.

## Evidence

- `libs/ui/README.md:7` says two consumption modes are supported.
- `libs/ui/README.md:28` introduces runtime package mode.
- `libs/ui/docs/content/getting-started/meta.json:3` has no dedicated package-mode page.
- `libs/ui/docs/content/integrations/keys.mdx:19` says UI components are visual-only.
- `libs/ui/registry/ui/tabs/tabs-list.tsx:5` imports `useNavigation`.
- `libs/ui/registry/ui/tabs/tabs-list.tsx:19` runs navigation behavior.
- `libs/ui/README.md:79` has only a short migration note.

## User Impact

Users cannot tell which mode is primary, when `@diffgazer/keys` is required, how copy-mode updates work, or what support guarantees apply during `0.x`.

## Fix

Add a canonical “Consumption Modes” page and mirror it in README, CLI README/help, docs, and governance. Rewrite keyboard docs to distinguish copied hooks, package peer hooks, and components that include local keyboard behavior. Regenerate changelog/inventory from registry metadata.

## Acceptance Criteria

- README, hosted docs, CLI docs, and package metadata describe the same two modes.
- Keyboard dependency language matches package peers and component imports.
- Changelog has real dates, current inventory, and migration notes.

## Verification

Review docs as a clean user and verify copy mode, keys-package mode, runtime package mode, and migration/update instructions all compile in fixtures.

