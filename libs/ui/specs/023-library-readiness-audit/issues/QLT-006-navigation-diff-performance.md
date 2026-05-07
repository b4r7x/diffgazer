# QLT-006: Navigation, DiffView, And Large Diff Behavior Need Hardening

Area: Navigation and data components

Severity: Medium

Priority: P2

Effort: M

## Problem

DiffView renders invalid pre/code structure, word diff has only per-pair LCS bounds, and NavigationList click selection does not move focus to the listbox container.

## Evidence

- `libs/ui/registry/ui/diff-view/diff-view-unified.tsx:25` and `diff-view-split.tsx:56` render block `<div>` rows inside `<pre><code>`.
- `libs/ui/registry/lib/diff/word.ts:14` and `word.ts:79` cap only individual word-pair LCS work.
- `libs/ui/registry/ui/diff-view/diff-view-unified.tsx:16` and `libs/ui/registry/lib/diff/split.ts:72` can process many changed pairs during render.
- `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx:187` clicks options without focusing the listbox container.
- `libs/ui/registry/hooks/use-listbox.ts:179` expects keyboard interaction on the listbox container through `aria-activedescendant`.

## User Impact

Diff markup can be invalid or brittle for SSR/copy/assistive traversal. Large diffs can freeze the UI despite per-pair caps. Mouse users who switch to keyboard after clicking NavigationList may find arrows/typeahead do not continue from the selected item.

## Fix

Render diff rows as phrasing content inside `pre/code` or move structured layout outside code semantics. Add aggregate word-diff budgets. Focus the NavigationList container on enabled item click.

## Acceptance Criteria

- No block elements under `pre code`.
- Large diffs fall back deterministically when aggregate word-diff budget is exceeded.
- Clicking an enabled NavigationList item moves focus to the listbox and keyboard navigation continues.

## Verification

Add SSR/DOM nesting tests for DiffView, performance budget tests for many replacement pairs, and click-to-keyboard tests for NavigationList.

