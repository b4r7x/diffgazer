# Task T-WEB-CLEANUP — Replace web hand-rolls with useActionRowNavigation + remove redundant escape

**Source findings:** WEB-001, WEB-002, NEW-020
**Severity:** Low (real but contained ~30-50 LOC per hook)
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
Three small cleanups in apps/web:

1. **WEB-001:** Three hooks hand-roll action-row navigation that `useActionRowNavigation` already provides:
   - `apps/web/src/features/providers/hooks/use-providers-keyboard.ts:81-89, 100-109, 187-205, 242-251` (buttons zone)
   - `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts:130-150, 310-329` (footer zone)
   - `apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts:182-201` (footer block)
   Replace those zones with `useActionRowNavigation`. Keep app-specific flow logic (cycle filter, method-aware transitions, needs-model skipping).

2. **WEB-002:** Remove redundant `useKey("Escape", onClose, ...)` from `use-api-key-dialog-keyboard.ts:203` and `use-model-dialog-keyboard.ts:337` non-search Escape — `DialogContent.onCancel` already closes. Keep the search-escape variants (those are app-specific).

3. **NEW-020:** `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx:52` passes `key={String(open)}` to `DialogContent`, forcing remount on open/close which bypasses Dialog's `restoreOnUnmount: false` focus restore. Remove the `key` prop OR justify with a comment explaining why remount is needed.

## Files to touch (allowlist)
- `apps/web/src/features/providers/hooks/use-providers-keyboard.ts`
- `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts`
- `apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts`
- `apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx`
- Related tests in `apps/web/src/features/providers/` if they exist (search for `*.test.tsx` in providers/)

## Files NOT to touch
- `libs/keys/src/hooks/use-action-row-navigation.ts` (already exists; consume it)
- `use-trust-form-keyboard.ts` (already composes cleanly per spec 029)
- Dialog/Field components
- Other web features

## Acceptance criteria
- [ ] Three identified hooks compose `useActionRowNavigation` for the buttons/footer zones (verify by code review)
- [ ] App-specific flow logic preserved (cycle filter, search escape, needs-model)
- [ ] Redundant `useKey("Escape", onClose, ...)` removed from api-key + model-dialog hooks (non-search Escape only)
- [ ] `key={String(open)}` on DialogContent in api-key-dialog removed (or commented justification)
- [ ] No behavior regression: dialogs still open/close, keyboard nav still works, escape still works
- [ ] All existing web tests pass: `pnpm --filter @diffgazer/web test`
- [ ] `pnpm --filter @diffgazer/web type-check` passes
- [ ] Focus restore on api-key-dialog close lands on the trigger that opened it (verify manually OR add behavior test)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
# Manual probe (out of automation):
# pnpm --filter @diffgazer/web dev
# Click "Add Provider" → API Key Dialog opens → focus inside → press Escape → focus returns to trigger button
```

## Notes & references
- Spec 029 §WEB-001/002, NEW-020
- `useActionRowNavigation` signature: see `libs/keys/src/hooks/use-action-row-navigation.ts`. Note that this hook's API may be improved in T-GENERICS — if T-GENERICS lands first, use the new signature.
- `restoreOnUnmount: false` in DialogContent means the dialog manages focus restore via its lifecycle; remounting bypasses it.

## Non-goals
- Do not refactor other web features
- Do not change libs/keys API (use what exists)
- Do not migrate the hooks elsewhere
- Do not address apps/web product copy or layout
