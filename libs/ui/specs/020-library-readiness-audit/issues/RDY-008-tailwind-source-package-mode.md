# RDY-008 - Tailwind v4 package scanning is undocumented and untested

**Area**: npm styling  
**Severity**: Critical  
**Effort**: Medium  
**Status**: Open

## Problem

The npm package ships components with Tailwind class strings. Tailwind v4 does not scan external dependencies by default, so package consumers need an explicit `@source` or a compiled CSS model.

## Evidence

- `libs/ui/styles/styles.css` imports Tailwind and theme files.
- `libs/ui/dist/styles.css` is generated from source CSS.
- Components in `libs/ui/registry/ui` use Tailwind utility classes.
- `libs/ui/README.md` shows CSS import but does not fully describe Tailwind source scanning.

## User Impact

Users can import components and CSS but still miss generated utility styles.

## Fix

Choose one package styling contract:

- Document and test `@source "../node_modules/@diffgazer/ui/dist";`, or
- Ship compiled component CSS.

## Acceptance Criteria

- A clean Tailwind v4 app renders npm-imported Button, Dialog, and Select correctly.
- Docs distinguish npm package styling from registry copy styling.

## Verification

- Vite + Tailwind v4 fixture.
- Next App Router + Tailwind v4 fixture.

