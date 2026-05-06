# RDY-004 - Package CSS contract is broken

**Area**: Tailwind/CSS package mode  
**Priority**: P0  
**Severity**: Critical  
**Effort**: Small/Medium

## Problem

Runtime package docs import `@diffgazer/ui/theme.css`, but component CSS such as dialog backdrop/animation CSS is appended to `@diffgazer/ui/styles.css`. The current built `dist/styles.css` is also malformed because theme CSS files are appended after normal CSS rules.

## Evidence

- `libs/ui/docs/content/getting-started/tailwind-setup.mdx:47` documents `@source` plus `@import "@diffgazer/ui/theme.css"`.
- `libs/ui/README.md:39` shows the same package-mode snippet.
- `libs/ui/package.json:380` exports `theme-base.css`, `theme.css`, and `styles.css`.
- `libs/ui/tsup.config.ts:129` appends registry CSS files to `dist/styles.css`.
- `libs/ui/tsup.config.ts:130` does not exclude the `registry:theme` item.
- `libs/ui/registry/registry.json:1690` declares theme CSS files.
- Batch B found current `dist/styles.css` has late `@import` rules after normal CSS.

## User Impact

Users following docs can lose dialog styling, scroll-lock/backdrop behavior, and Tailwind processing can reject or mishandle late imports.

## Fix

Aggregate only non-theme component CSS into `dist/styles.css`. Make `@diffgazer/ui/styles.css` the canonical package-mode CSS entry, and document `theme.css` only as a theme-only advanced entry.

## Acceptance Criteria

- `dist/styles.css` has imports only at the top.
- `dist/styles.css` contains shared dialog CSS.
- Package docs have one canonical Tailwind v4 package-mode snippet.

## Verification

Build UI, inspect CSS ordering, then compile clean Vite and Next App Router package-mode fixtures rendering Button, Dialog, Select, Menu, and Toast.

