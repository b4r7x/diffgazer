# Task T-DOCS-PROPS — Populate props for 33 components + add <APIReference />

**Source findings:** DOCS-001
**Severity:** High
**Phase:** 1
**Blocks:** Public handoff (without API reference, users must read source)
**Blocked by:** T-VITE-ALIAS

## Goal
33 of 44 UI component MDX pages have `<APIReference />` missing AND the underlying `libs/ui/docs/generated/components/<name>.json` has `"props": {}`. Two layers of fix:

1. Fix the props extractor so `pnpm --filter @diffgazer/ui build:docs-data` emits real props for the 33 missing components.
2. Add `<APIReference />` MDX tag to the 33 component pages.

## Files to touch (allowlist)
- `libs/ui/scripts/build-docs-data.ts` (the props extractor — find why it emits `{}` for these 33)
- `libs/ui/registry/component-docs/*.ts` (if extractor reads metadata from here)
- `apps/docs/content/docs/ui/components/*.mdx` (the 33 missing `<APIReference />` insertions)
- `libs/registry/src/docs-data/*` (if the extraction logic lives here)
- `libs/ui/docs/generated/components/*.json` (regenerated, do NOT hand-edit)

## Files NOT to touch
- `libs/ui/registry/ui/**/*.tsx` (component source — the extractor must work with what's there, not the other way around)
- Existing `<APIReference />` tags on the 11 working components
- Component prop types (don't refactor public types to "make the extractor happier")

## Acceptance criteria
- [ ] After `pnpm --filter @diffgazer/ui build:docs-data`, all 44 `libs/ui/docs/generated/components/*.json` have non-empty `props` field
- [ ] All 44 MDX pages in `apps/docs/content/docs/ui/components/` render `<APIReference />` (cross-check: `grep -L APIReference apps/docs/content/docs/ui/components/*.mdx | wc -l` returns 0)
- [ ] Pure-visual components (`avatar`, `badge`, `card`, `divider`, `kbd`, `logo`, `spinner`, `typography`, `key-value`, `icons`, `pager`) that genuinely have no props beyond standard React HTML attributes can either: (a) still render `<APIReference />` showing their inherited HTML attributes, OR (b) be explicitly exempted via a `noProps: true` flag in the generated JSON — pick ONE approach and apply consistently
- [ ] `pnpm --filter @diffgazer/docs build` exits zero
- [ ] Existing 11 components are unchanged (their props were already extracted)
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui build:docs-data
# Count empty props in generated data
empty=0
for f in libs/ui/docs/generated/components/*.json; do
  if grep -q '"props": {}' "$f"; then
    empty=$((empty+1))
    echo "still empty: $f"
  fi
done
echo "Total still empty: $empty"  # must be 0 (or only the explicit `noProps` exemptions)
# Confirm APIReference present in MDX
grep -L APIReference apps/docs/content/docs/ui/components/*.mdx
# Build docs
pnpm --filter @diffgazer/docs build
pnpm --filter @diffgazer/ui validate:registry
```

## Notes & references
- Spec 029 §DOCS-001
- Working examples: `apps/docs/content/docs/ui/components/button.mdx`, `field.mdx`, `dialog.mdx`, `select.mdx`, `checkbox.mdx`, `radio.mdx`, `input.mdx`, `textarea.mdx`, `callout.mdx`, `command-palette.mdx`, `search-input.mdx` (these 11 work today)
- Broken examples: `accordion.mdx`, `avatar.mdx`, `popover.mdx`, `sidebar.mdx`, `menu.mdx`, `tooltip.mdx`, `tabs.mdx`, `toast.mdx`, and 25 others
- The extractor likely uses TypeScript compiler API or a JSDoc-based parser. Find where the 11 working components differ structurally from the 33 broken ones — common cause is named exports vs `export default`, type alias vs interface, conditional types, or missing `@public` JSDoc tags.

## Non-goals
- Do not refactor component prop type definitions to make extraction easier (component public API is fixed).
- Do not introduce a new docs metadata format.
- Do not write JSDoc for each prop (that's T-EXAMPLES — separate task).
- Do not change `<APIReference />` rendering behavior.
- Do not split the task across components — fix the EXTRACTOR (one root cause), then mechanically add the MDX tag to 33 files.

## Investigation hints
1. Compare a working component's prop type structure to a broken one:
   - Working: `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { ... }` (button.tsx)
   - Broken: ? Check `accordion.tsx`, `popover.tsx` — what's different?
2. The extractor entry: `libs/ui/scripts/build-docs-data.ts` calls something in `libs/registry/src/docs-data/`. Walk the call chain.
3. Sample failures: `libs/ui/docs/generated/components/accordion.json` has `props: {}` while `button.json` has populated props. Diff them.
