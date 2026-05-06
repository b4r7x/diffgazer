# QLT-008 - Focusable hidden/unnamed regions need cleanup

**Area**: Focus management and region naming  
**Priority**: P2  
**Severity**: Medium/High  
**Effort**: Small/Medium

## Problem

Some visually hidden/collapsed or scrollable regions remain focusable without proper semantics or names.

## Evidence

- `libs/ui/registry/ui/stepper/stepper-content.tsx:16` hides collapsed content with `aria-hidden` but does not make descendants inert.
- `libs/ui/registry/ui/code-block/code-block-content.tsx:14` creates a scrollable code body.
- `libs/ui/registry/ui/scroll-area/scroll-area.tsx:34` can create a focusable scroll area requiring a name.
- `libs/ui/registry/ui/sidebar/sidebar.tsx:18` creates navigation semantics.
- `libs/ui/registry/ui/sidebar/sidebar-content.tsx:23` adds another navigation role.
- `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx:85` references description IDs even when subtitle/meta are absent.
- `libs/ui/registry/ui/pager/pager-link.tsx:39` fixed labels can hide destination names.

## User Impact

Keyboard users can tab into collapsed content or unnamed scroll stops, and screen reader users can hear duplicated landmarks or incomplete link/description context.

## Fix

Add `inert` to collapsed Stepper content, require/pass accessible names for focusable ScrollArea/CodeBlock regions, avoid nested landmarks by default, and only set ARIA IDREFs when targets exist.

## Acceptance Criteria

- Collapsed content descendants cannot receive focus.
- Focusable scroll/code regions have names.
- Sidebar has one navigation landmark by default.
- ARIA IDREFs point to mounted elements only.

## Verification

`user.tab()` tests, role/name assertions, and rerender tests with/without subtitle/meta/pager destination content.

