# Task T-THEME-CONTRACT — Enforce theme dependency for shadcn UI installs

**Source findings:** NEW-017
**Severity:** High
**Phase:** 1
**Blocks:** none
**Blocked by:** none

## Goal
A consumer running `npx shadcn add https://diffgazer.com/r/ui/button.json` today gets `button.tsx` + `spinner.tsx` (button's only declared `registryDependency`). The component uses theme tokens (`bg-primary`, `bg-action`, `text-success-strong-foreground`, `border-error-border`, `--dialog-duration`) that are defined only in `libs/ui/styles/theme-base.css` / `theme.css` shipped via the `theme` registry item. Result: button installs without styles, looks unstyled/broken.

`smoke-shadcn-install.mjs` installs `theme` first, so it does not catch the consumer-facing failure path.

Pick one approach:

**Option A:** Add `theme` to every public UI item's `registryDependencies`. Pros: automatic. Cons: re-installs theme every time (idempotent but noisy).

**Option B:** Document "install `theme` first" prominently AND add a smoke test that exercises the single-component install path (without prior theme install) and asserts that the user is told.

**Option C:** Emit `cssVars` per shadcn schema on each item that uses theme tokens. shadcn merges these into the consumer's `globals.css` automatically. Most SOTA approach.

Recommend Option C if achievable (uses the shadcn schema as intended). Fallback to A if C is too invasive.

## Files to touch (allowlist)
- `libs/ui/registry/registry.json` (source manifest — add `cssVars` field per item OR add `registryDependencies: ["theme"]`)
- `libs/ui/scripts/build-shadcn-registry.ts` (extractor — emit `cssVars` from theme.css if Option C, OR inject `theme` dep if Option A)
- `libs/ui/scripts/transform-public-registry-keys-imports.ts` (if cssVars need rewriting)
- `libs/ui/public/r/*.json` (regenerated)
- `scripts/monorepo/smoke-shadcn-install.mjs` (add a smoke that installs ONLY `button.json` without prior `theme.json`)

## Files NOT to touch
- Theme CSS files (separate concern)
- Other registry source files (`libs/ui/registry/ui/**`)
- `cli/add/` (this is shadcn install path, not dgadd)

## Acceptance criteria
- [ ] After fix, `npx shadcn add https://<origin>/r/ui/button.json` into a clean Vite+React+Tailwind project produces a working styled button (manual verification OR via smoke test that diffs against expected installed styles)
- [ ] The fix is consistent across all public UI items that use theme tokens (no item is half-fixed)
- [ ] `smoke-shadcn-install.mjs` includes a new scenario: install single component without prior `theme` install, then assert styles work
- [ ] Existing smoke scenarios still pass
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes
- [ ] No public API change

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui build:shadcn
pnpm --filter @diffgazer/ui validate:registry
pnpm run smoke:shadcn
# Manual probe (out of automation, no commits):
rm -rf /tmp/shadcn-theme-test && mkdir /tmp/shadcn-theme-test
cd /tmp/shadcn-theme-test
pnpm init -y && pnpm add -D vite @vitejs/plugin-react react react-dom tailwindcss typescript
# Set up shadcn config pointing at local registry, run `npx shadcn add <local-path>/r/ui/button.json`
# Verify the resulting button renders styled
```

## Notes & references
- Spec 029 §NEW-017
- shadcn registry-item schema for `cssVars`: https://ui.shadcn.com/docs/registry/registry-item-json (search "cssVars")
- shadcn merges `cssVars.light` and `cssVars.dark` into the consumer's `globals.css` under `:root` and `.dark` selectors.
- Option C example payload:
  ```json
  {
    "name": "button",
    "cssVars": {
      "light": {"--primary": "..."},
      "dark": {"--primary": "..."}
    }
  }
  ```

## Non-goals
- Do not change the theme.css file structure (just declare which tokens each item depends on).
- Do not add per-component theme variants.
- Do not redesign the registry item schema.
- Do not block on `diffgazer.com` deploy (use local file:// or local HTTP server in smoke).

## Decision matrix

| Question | Option A (add theme dep) | Option C (cssVars) |
|----------|---|---|
| Implementation effort | Low | Medium (must enumerate per-item tokens) |
| Shadcn-idiomatic | No | Yes |
| Consumer experience | Theme item installed | Tokens merged into existing globals.css |
| Re-install noise | Some | None |
| Per-item granularity | All-or-nothing | Per item |

Default to C. If extracting which tokens each component uses is too brittle, default to A.
