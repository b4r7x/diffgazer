# RDY-005: Tailwind And CSS Contract Is Ambiguous

Area: Tailwind v4 and CSS integration

Severity: P0

Effort: L

## Problem

The package-mode and copy-first CSS setup are not expressed as one stable contract. Docs tell users to import Tailwind and then import UI styles, but the shipped UI styles import Tailwind again. Copy-first component CSS also has Next/global CSS risks.

## Evidence

- `libs/ui/README.md:42-45` documents importing Tailwind, adding `@source`, and importing `@diffgazer/ui/styles.css`.
- `libs/ui/docs/content/getting-started/tailwind-setup.mdx:49-52` repeats that setup.
- `libs/ui/styles/styles.css:1-2` and `libs/ui/dist/styles.css:1-2` also import Tailwind.
- `libs/ui/registry/ui/dialog/dialog-shell.tsx:14` imports `./dialog.css`.
- `libs/ui/registry/ui/dialog/dialog.css:1-37` is component-level global CSS.
- `libs/ui/registry.json:728-748` includes the dialog shell/CSS relationship.
- `libs/ui/tsup.config.ts:66-74` and `libs/ui/tsup.config.ts:128-146` aggregate or drop CSS differently for package output.
- `libs/ui/docs/content/getting-started/tailwind-setup.mdx:61-74` documents theme tokens that do not match the minimal monochrome variables in `libs/ui/styles/theme.css:8-23`.

## User Impact

Users can get duplicate Tailwind imports, wrong source scanning, component CSS that fails under Next App Router restrictions, or theme tokens that do not match the installed package.

## Fix

Define separate, tested contracts for package-mode and copy-first mode.

Concrete fix:

- Decide whether `@diffgazer/ui/styles.css` owns `@import "tailwindcss"` or assumes the consumer owns it.
- Update docs so the package-mode import order has no duplicate Tailwind import.
- For copy-first mode, move component CSS into a generated global stylesheet or install instruction that is Next-safe.
- Align documented theme tokens with shipped `theme.css`.
- Add Vite and Next clean project smoke tests for both CSS modes.

## Acceptance Criteria

- The documented package-mode CSS setup has exactly one Tailwind import.
- Tailwind v4 scans UI package output when package mode is used.
- Copy-first dialog/popover installs build in Next App Router without illegal component CSS imports.
- Theme docs and shipped CSS variables match.

## Verification

Clean consumer checks:

- Vite package-mode: import documented CSS, use `Button`, `Dialog`, and `Select`, run build.
- Next App Router package-mode: same components, run build.
- Next App Router copy-first: install `dialog`, run build.
- Inspect generated CSS for expected utility classes and variables.

