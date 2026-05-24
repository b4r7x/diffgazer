# Task T-LOW-HYGIENE — Comment fix + sourcemap policy + workflow rename + split public-handoff changeset

**Source findings:** NEW-016, NEW-028, ART-001, DOCS-003
**Severity:** Low
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
Four small hygiene items bundled to avoid 4 separate PRs:

1. **NEW-016 (Low):** `libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx:74` comment says "Confirm dialog (uses useFocusTrap + useScrollLock internally)" — it doesn't (Dialog uses native `<dialog>.showModal`). Fix the comment.

2. **NEW-028 (Low):** `@diffgazer/keys` ships 48 sourcemap files (`.js.map` + `.d.ts.map`). `@diffgazer/ui` (tsup-built) ships zero. Inconsistent. Pick one policy.

3. **ART-001 (Low):** `release-readiness.yml` step is named "Generated files are committed" but it actually validates "public registry is up to date with source." Misleading. Rename.

4. **DOCS-003 (Medium):** `.changeset/public-handoff-docs.md` lumps 6 unrelated migrations into one bump. Split into per-package per-concern changesets.

## Files to touch (allowlist)
- `libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx` (line 74 comment)
- `libs/keys/tsconfig.json` (disable sourcemap emission OR keep and enable for ui too — pick one)
- `libs/keys/package.json` `files` (exclude `.map` if disabling)
- `.github/workflows/release-readiness.yml` (step name)
- `.changeset/public-handoff-docs.md` (split into multiple files)

## Files NOT to touch
- Anything else

## Acceptance criteria
- [ ] `keyscope-copy-mode.tsx:74` comment accurately describes what Dialog uses (native `<dialog>`, not `useFocusTrap`)
- [ ] `@diffgazer/keys` tarball has the same sourcemap policy as `@diffgazer/ui` (either both ship maps or neither — recommend NEITHER for runtime; sourcemaps in dist are mostly useful for source links in npm view)
- [ ] `release-readiness.yml` step renamed to "Public registry is up to date" or "No drift in committed registry handoff"
- [ ] `.changeset/public-handoff-docs.md` split into per-concern files:
  - `.changeset/keys-rename-aliases.md` (keys API renames)
  - `.changeset/ui-rename-aliases.md` (ui API renames including InputGroup, Field)
  - `.changeset/ui-keys-peer-floor.md` (peer bump)
  - `.changeset/add-publish-doc.md` (doc-only)
  - etc.
- [ ] All tests pass
- [ ] `pnpm changeset status` is clean

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
grep "Confirm dialog" libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx
ls .changeset/*.md
cat .changeset/public-handoff-docs.md 2>/dev/null || echo "split successful"
grep "Generated files" .github/workflows/release-readiness.yml
pnpm changeset status
pnpm --filter @diffgazer/keys pack --dry-run | grep "\.map" | head -3
```

## Notes & references
- Spec 029 §NEW-016, NEW-028, ART-001, DOCS-003

## Non-goals
- Do not change the registry handoff contract
- Do not modify build pipeline structure
- Do not bump versions (changesets handles)
