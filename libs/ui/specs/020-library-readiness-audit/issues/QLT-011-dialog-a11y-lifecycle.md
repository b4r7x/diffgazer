# QLT-011 - Dialog labeling, backdrop clicks, and lifecycle handlers are fragile

**Area**: Dialog  
**Severity**: Medium to High  
**Effort**: Medium  
**Status**: Open

## Problem

Dialog can point `aria-labelledby` at a missing title, lacks explicit modal labeling guarantees, can misread backdrop clicks, and can let consumer handlers override lifecycle work.

## Evidence

- `libs/ui/registry/ui/dialog/dialog-content.tsx`
- `libs/ui/registry/ui/dialog/dialog-title.tsx`
- `libs/ui/registry/ui/shared/dialog-shell.tsx`

## User Impact

Dialogs can be unnamed, close unexpectedly, or fail to unmount/close if handlers are overridden.

## Fix

- Track title presence.
- Emit `aria-labelledby` only when a title exists.
- Allow `aria-label` fallback.
- Set `aria-modal` for modal dialogs.
- Compose internal and consumer handlers.

## Acceptance Criteria

- Dialog can be named by title or `aria-label`.
- Consumer handlers cannot break internal close cleanup.

## Verification

- A11y tests for title and label fallback.
- Handler composition tests.

