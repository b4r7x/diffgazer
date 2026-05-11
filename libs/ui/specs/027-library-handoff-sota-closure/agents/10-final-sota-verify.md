# Agent 10: Final SOTA Verify And Closure

Model: Opus 4.7
Mode: verification and fix loop

## Required Skills

Load before work:

- `$sota`
- `$code-audit`
- `$sota-verify`
- `superpowers:verification-before-completion`
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `architecture`
- `typescript-expert`
- `superpowers:test-driven-development`

## Write Ownership

Final verification may touch any file required to fix findings, but must avoid unrelated refactors. If a finding belongs to a specific prior agent's area, prefer sending it back to that owner or making the smallest direct fix.

## Requirements

1. Read `../spec.md`.
2. Read all `../issues/*.md`.
3. Read all `../agents/*.md`.
4. Run `$sota-verify` against this spec.
5. Dispatch read-only review agents if needed:
   - keys runtime;
   - keys registry/CLI/docs;
   - UI public API/forms;
   - UI overlays/APG;
   - UI registry/package/docs;
   - web adoption;
   - tests.
6. Fix every finding, including Low and Info, unless the spec explicitly documents a deferral.
7. Re-run focused tests after every fix batch.
8. Re-run final gates.

## Final Gates

Run:

```bash
pnpm run prepare:artifacts
pnpm --filter @diffgazer/keys validate:registry
pnpm --filter @diffgazer/ui validate:registry
pnpm run validate:artifacts:check
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
pnpm run verify
git diff --check
```

Run greps:

```bash
rg -n "useKeys|useZoneKeys|use-tab-navigation|useTabNavigation|onMethodKeyDown|onMethodNavigate|onMethodChange|from \"@/lib/vertical-navigation\"" apps/web/src libs/keys/src libs/ui/registry cli/add/src
rg -n "highlightedId|defaultHighlightedId|onHighlightValueChange|visible|defaultVisible|onVisibleChange|onValueChange|onCheckedChange" libs/ui/registry apps/web/src
rg -n "DONE|RUN|WAIT|FAIL|analyzing\\.\\.\\.|diffgazer/apps/server" libs/ui/registry
```

Internal-only matches are allowed only if explained in the final report.

## Final Report

Report:

- `$sota-verify` result;
- root verification result;
- all package test/type-check/registry results;
- optional smoke skips with exact reason;
- public API changes;
- remaining caveats, if any.

Do not claim "SOTA 5/5" unless the verify loop is clean and all final gates pass.
