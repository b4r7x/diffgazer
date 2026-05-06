# RDY-007 - CSS can be tree-shaken from the npm package

**Area**: npm packaging  
**Severity**: Critical  
**Effort**: Small  
**Status**: Open

## Problem

`@diffgazer/ui` exports CSS files but package metadata marks the whole package as side-effect free. CSS imports are side effects and must be preserved.

## Evidence

- `libs/ui/package.json` sets `"sideEffects": false`.
- `libs/ui/package.json` exports `theme-base.css`, `theme.css`, and `styles.css`.

## User Impact

Bundlers can drop documented CSS imports, leaving components unstyled.

## Fix

Use CSS side-effect allowlisting:

```json
"sideEffects": ["**/*.css"]
```

## Acceptance Criteria

- CSS imports are preserved in consumer builds.
- JS remains tree-shakeable.

## Verification

- Vite and webpack-like fixture importing `@diffgazer/ui/styles.css`.

