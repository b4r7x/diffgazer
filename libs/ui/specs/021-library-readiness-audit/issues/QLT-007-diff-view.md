# QLT-007 - DiffView and diff computation have correctness/performance gaps

**Area**: Diff utilities and DiffView  
**Priority**: P2  
**Severity**: High  
**Effort**: Medium

## Problem

Diff computation handles empty files incorrectly, DiffView can keep stale active hunk state, and rendering recomputes expensive word/split diffs on navigation.

## Evidence

- `libs/ui/registry/lib/diff/compute.ts:7` uses raw line splitting that treats `""` as a blank line.
- `libs/ui/registry/ui/diff-view/diff-view.tsx:132` keeps derived active state.
- `libs/ui/registry/ui/diff-view-unified.tsx:27` recomputes annotated rows.
- `libs/ui/registry/ui/diff-view-split.tsx:38` recomputes split rows.
- `libs/ui/registry/lib/diff/lcs.ts:4` allows large matrices.
- `libs/ui/registry/ui/diff-view-unified.tsx:31` exposes fake button roles for hunk headers.
- `libs/ui/registry/ui/diff-view-split.tsx:59` does the same.

## User Impact

Empty-file diffs can show fake blank changes, large diffs can freeze the UI, and assistive tech can see non-activatable buttons.

## Fix

Use a diff-aware line splitter, reset/clamp active hunk by parsed content identity, memoize annotated/split rows, cap LCS work, and remove fake button roles unless activation is implemented.

## Acceptance Criteria

- Empty-to-text and text-to-empty diffs have zero-line add/remove counts where appropriate.
- Same-hunk-count content changes reset correctly.
- Large word diffs fall back safely.
- Hunk headers are not announced as buttons.

## Verification

Unit tests for empty files/final newlines, rerender tests, large diff fallback tests, and role assertions.

