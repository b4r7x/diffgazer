# Quickstart: Diff-UI Web Integration

**Branch**: `001-diffui-web-integration` | **Date**: 2026-03-24

## What This Feature Does

Replaces the internal implementations of @diffgazer/ui components with re-exports from the diff-ui library. Consumer code (the web app) continues importing from `@diffgazer/ui` unchanged. The theme is layered: diff-ui provides base tokens, diffgazer overrides colors to match its GitHub-inspired palette.

## Implementation Order

1. **Workspace linking** — Add `diffui: "workspace:*"` to @diffgazer/ui's package.json
2. **Direct re-exports** — Replace 16 component implementations with re-exports from diff-ui
3. **Adapted re-exports** — Create thin wrappers for 10 components with API differences
4. **Token override** — Create theme-overrides.css, update CSS import order
5. **Cleanup** — Remove replaced component source files, deduplicate cn()

## Key Files to Modify

| File | Change |
| ---- | ------ |
| `packages/ui/package.json` | Add `diffui: "workspace:*"` dependency |
| `packages/ui/src/index.ts` | Change component imports from local to diff-ui re-exports |
| `packages/ui/src/styles/theme.css` | Refactor into theme-overrides.css (only diffgazer-specific values) |
| `apps/web/src/styles/index.css` | Update import order to load diff-ui theme first |
| `packages/ui/src/components/*` | Remove files for components now re-exported from diff-ui |

## Key Files NOT to Modify

- `apps/web/src/**/*.tsx` — No consumer files change (re-export facade)
- `apps/web/src/app/providers/index.tsx` — KeyboardProvider stays as-is
- Any keyscope-related code — Already fully integrated

## Verification

```bash
pnpm install                    # Workspace linking resolves
pnpm --dir apps/web build       # Build succeeds with zero errors
pnpm --dir apps/web dev         # Visual verification in browser
# Check: dark mode colors match GitHub palette
# Check: light mode colors match GitHub palette
# Check: keyboard navigation works on all pages
```
