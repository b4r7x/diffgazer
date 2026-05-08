# RDY-004: Tailwind CSS Contract Needs One Canonical Component Entry

Area: Tailwind v4 and CSS handoff

Severity: Medium

Priority: P1

Effort: S

## Problem

The package/copy CSS build is mostly correct, but manual Tailwind docs still suggest importing only `theme.css` in at least one path. `theme.css` omits component-global CSS such as dialog backdrop rules; UI component consumers need `styles.css`.

## Evidence

- `libs/ui/package.json:16` preserves CSS side effects.
- `libs/ui/package.json:404` exports `theme-base.css`, `theme.css`, `sources.css`, and `styles.css`.
- `libs/ui/tsup.config.ts:131` appends registry component CSS into `dist/styles.css`.
- `cli/add/src/commands/init.ts:115` writes copied `theme.css` and aggregated `styles.css`.
- `libs/ui/registry/ui/shared/dialog.css:1` is component-global CSS that `theme.css` alone does not include.
- `libs/ui/docs/content/getting-started/tailwind-setup.mdx:53` correctly documents package mode with `@import "@diffgazer/ui/sources.css"` and `@import "@diffgazer/ui/styles.css"`, but the manual setup section still needs to make `styles.css` canonical for components.

## User Impact

Users following a theme-only import path can miss dialog backdrop/animation CSS and see broken or inconsistent component behavior.

## Fix

Make `styles.css` the single documented component CSS entry. Document `theme.css` as theme-only or advanced token-only usage.

## Acceptance Criteria

- Copy-first docs use `@import "./styles/styles.css"` for component consumers.
- Package-mode docs use `@import "@diffgazer/ui/sources.css"` plus `@import "@diffgazer/ui/styles.css"`.
- `theme.css` is described as token-only/advanced.
- Built consumer CSS includes theme tokens, Tailwind utilities, and component global selectors such as `dialog::backdrop`.

## Verification

Run `pnpm --filter @diffgazer/ui build`, `pnpm run smoke:packages`, and `pnpm run smoke:cli`. In clean fixtures, grep emitted CSS for `--tui-bg`, `.bg-primary`, and `dialog::backdrop`.
