# Task T-LOCALE-SEARCH — Locale-aware typeahead + search

**Source findings:** I18N-001, NEW-006
**Severity:** Medium
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
Three places use default `.toLowerCase()` instead of `.toLocaleLowerCase()` — breaks Turkish dotted I, German ß:

- `libs/ui/registry/hooks/use-typeahead-buffer.ts:27`
- `libs/ui/registry/lib/typeahead.ts:35`
- `libs/ui/registry/lib/search.ts:2`

Fixing only one leaves mismatches. Fix all three plus add locale-aware normalization. Decide:

- **Option A (minimum):** Replace `.toLowerCase()` with `.toLocaleLowerCase()`. Preserves API.
- **Option B (full):** Add `Intl.Collator`-based comparison + Unicode normalization (`String.prototype.normalize("NFC")`) + diacritic folding.

Recommend Option A as default. File Option B as follow-up if real i18n consumer asks.

## Files to touch (allowlist)
- `libs/ui/registry/hooks/use-typeahead-buffer.ts`
- `libs/ui/registry/lib/typeahead.ts`
- `libs/ui/registry/lib/search.ts`
- Tests for each (add Turkish-I case at minimum)
- Regenerated `libs/ui/public/r/typeahead-buffer.json`, `typeahead.json`, `search.json`

## Files NOT to touch
- Consumers (Listbox, Select, CommandPalette, Menu)
- Other hooks

## Acceptance criteria
- [ ] All three files use `.toLocaleLowerCase()` consistently
- [ ] New tests: Turkish dotted I (`"İ".toLocaleLowerCase("tr") === "i̇"` round-trips), German ß, composed Unicode
- [ ] Existing tests pass
- [ ] No API change
- [ ] Document locale semantics in JSDoc (which locale is used by default — usually no arg = ICU default)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- typeahead search
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
```

## Notes & references
- Spec 029 §NEW-006, I18N-001

## Non-goals
- Do not adopt `Intl.Collator` in this task (separate Option B)
- Do not change matching algorithm semantics
- Do not introduce a locale prop on Select/Menu (consumer can pass to `toLocaleLowerCase(locale)` if needed — follow-up)
