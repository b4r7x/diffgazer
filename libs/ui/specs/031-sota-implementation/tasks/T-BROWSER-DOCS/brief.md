# Task T-BROWSER-DOCS — Document browser support + add backdrop-filter prefix

**Source findings:** NEW-031
**Severity:** Medium
**Phase:** 3
**Blocks:** none
**Blocked by:** none

## Goal
- No declared `browserslist`, no `engines` for browser libs, no README/docs statement.
- De facto floor is Tailwind v4: Chrome 111 / Safari 16.4 / Firefox 128.
- `dialog.css:14` uses `backdrop-filter: blur(4px)` without `-webkit-backdrop-filter:` prefix → Safari 16.4-17.x falls back to solid (no blur).
- `scrollbar-gutter: stable` on global `html` (theme-base.css:62) requires Safari 18.2+ — Safari 16.4-18.1 ignores → layout shift.

## Files to touch (allowlist)
- `libs/ui/package.json` (add `"browserslist"` field declaring the floor)
- `libs/ui/README.md` (add "Supported browsers" section)
- `apps/docs/content/docs/ui/index.mdx` (add browser support to overview)
- `libs/ui/registry/ui/shared/dialog.css:14` (add `-webkit-backdrop-filter: blur(4px);` line)
- `libs/ui/styles/theme-base.css:62` (optionally add a `@supports` guard around `scrollbar-gutter`)
- `libs/ui/public/r/dialog-shell.json`, `theme.json` (regenerated)

## Files NOT to touch
- Other CSS files
- React component source
- Theme tokens

## Acceptance criteria
- [ ] `libs/ui/package.json` has `"browserslist": ["last 2 Chrome versions", "last 2 Safari versions", "last 2 Firefox versions", "Chrome >= 111", "Safari >= 16.4", "Firefox >= 128"]` (or equivalent)
- [ ] `libs/ui/README.md` has "Supported browsers" section explicitly listing Chrome 111+, Safari 16.4+, Firefox 128+, with cosmetic-degradation footnotes (scrollbar-gutter on Safari 16.4-18.1, backdrop-filter on Safari 16.4-17.x if not prefixed)
- [ ] `dialog.css:14` has `-webkit-backdrop-filter: blur(4px);` BEFORE the unprefixed `backdrop-filter:` (CSS precedence)
- [ ] After build:shadcn, `libs/ui/public/r/dialog-shell.json` reflects the change
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes
- [ ] Optional: `apps/docs/content/docs/ui/index.mdx` summarizes the floor

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
grep -A 5 "browserslist" libs/ui/package.json
grep -B 1 -A 3 "backdrop-filter" libs/ui/registry/ui/shared/dialog.css
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/dialog-shell.json
pnpm --filter @diffgazer/ui validate:registry
```

## Notes & references
- Spec 029 §NEW-031
- Tailwind v4 floor per their docs: https://tailwindcss.com/docs/installation/using-vite (browser requirements)
- `-webkit-backdrop-filter` is the older Safari prefix; modern Safari 18+ supports unprefixed

## Non-goals
- Do not raise the floor to require Safari 18+ (cuts users)
- Do not add IE/legacy Edge support
- Do not adopt a polyfill for `:has()` or `inert`
- Do not modify other components
