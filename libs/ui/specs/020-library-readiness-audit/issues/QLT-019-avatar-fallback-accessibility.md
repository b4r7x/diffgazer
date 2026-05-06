# QLT-019 - Avatar fallback and accessible naming are fragile

**Area**: Avatar  
**Severity**: Medium  
**Effort**: Medium  
**Status**: Open

## Problem

Avatar fallback image handling can fail to render children after fallback image failure. Compound usage can also become unnamed if fallback text is hidden and the root lacks a label.

## Evidence

- `libs/ui/registry/ui/avatar/avatar.tsx`
- `libs/ui/registry/ui/avatar/avatar-fallback.tsx`
- `libs/ui/registry/ui/avatar/use-image-status.ts`

## User Impact

Users can see missing fallback content, and assistive tech can receive unnamed avatars.

## Fix

- Track fallback image failure and render children afterward.
- Provide an accessible-name path for compound fallback content.

## Acceptance Criteria

- Primary and fallback image failures still render final text/children.
- Compound avatar has an accessible name.

## Verification

- Image error tests and accessible-name tests.

