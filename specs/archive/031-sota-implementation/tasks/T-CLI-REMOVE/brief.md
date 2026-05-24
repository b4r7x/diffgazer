# Task T-CLI-REMOVE — dgadd remove reverse-dep + cascade + diff manifest scope + CSS ownership

**Source findings:** CLI-001, CLI-002, CLI-003, NEW-018
**Severity:** Critical (data corruption — silently breaks consumer apps)
**Phase:** 0
**Blocks:** T-PUBLISH-WF (cannot publish CLI that breaks consumer apps)
**Blocked by:** none

## Goal
`dgadd remove` currently has four bugs that together corrupt the consumer's app:

1. **No reverse-dependency walk** — `dgadd remove ui/button` deletes `button/` even when `ui/dialog` (retained) imports `Button`. Consumer's build silently breaks.
2. **No orphan cleanup** — `dgadd remove ui/dialog` leaves `ui/button`, `ui/dialog-shell`, `ui/portal`, `keys/focus-restore`, `ui/kbd`, `ui/spinner`, etc. on disk and in the manifest. No prompt, no warning.
3. **Diff ignores manifest-only items** — `dgadd diff` (no args) only checks public install names; hidden items that drifted are silent.
4. **CSS chunks not ownership-tracked** — when `dgadd add ui/dialog` writes CSS chunks into styles, `dgadd remove` does not remove them and `dgadd diff` does not detect drift in them.

## Files to touch (allowlist)
- `libs/registry/src/cli/workflows/remove.ts` (`collectRemovalTargets`, `findOrphanedNpmDeps`, retention computation)
- `cli/add/src/commands/remove.ts` (the keys→copy-mode-ui guard at lines 62-86 — generalize for ui→ui; also lines 94-101 wiring `getAllItems` from `publicInstallNames` — must walk manifest)
- `cli/add/src/commands/diff.ts` (line 30-35 default scope — must walk manifest, not just public)
- `cli/add/src/utils/namespaces.ts` (relax `validateInstallNames` for `diff` so hidden items can be queried)
- `cli/add/src/commands/add/manifest.ts` (record CSS chunk ownership per item)
- `cli/add/src/utils/css-ops.ts` (or wherever CSS is written — add ownership marker + removal logic)
- `cli/add/src/commands/cli-behavior.test.ts` — add behavior tests for: (a) blocked remove of retained dep, (b) cascade-or-prompt for orphans, (c) diff detects hidden-item drift, (d) CSS chunk added/removed/diffed
- `libs/registry/src/cli/workflows/init-workflow.test.ts` if remove logic is exercised there

## Files NOT to touch
- Existing add workflow (unless adding ownership metadata for CSS)
- Public CLI command names / flags (preserve `dgadd add`, `dgadd remove`, `dgadd diff`)
- `cli/diffgazer/`

## Acceptance criteria

### Reverse-dep guard
- [ ] In a fixture project: `dgadd add ui/dialog`, then `dgadd remove ui/button --yes` prints `Keeping ui/button; still required by: ui/dialog` and exits 0 with `button.tsx` still on disk.
- [ ] Manifest is unchanged when remove is blocked.
- [ ] Pattern generalizes: works for ANY ui→ui or keys→ui dep relationship, not just dialog→button.

### Cascade / orphan cleanup
- [ ] After `dgadd add ui/dialog`, `dgadd remove ui/dialog --yes`:
  - Either cascade-removes all orphans (preferred), OR
  - Prints structured message listing each orphan and one-line command to clean (e.g. `dgadd prune --orphans`).
- [ ] If cascade is chosen: each orphan goes through the same reverse-dep guard (a transitive that's still needed by another retained item stays).
- [ ] Manifest is updated to reflect actual on-disk state.

### Diff manifest scope
- [ ] `dgadd diff` (no args) detects drift in ANY installed item, including hidden transitives like `ui/portal`.
- [ ] `dgadd diff ui/portal` (or any installed hidden item) is accepted, not rejected by `validateInstallNames`.
- [ ] Test: `dgadd add ui/dialog`, edit `src/components/ui/shared/portal.tsx`, `dgadd diff` reports the drift.

### CSS chunk ownership
- [ ] `dgadd add ui/dialog` writes CSS chunks AND records which item owns each chunk in the manifest.
- [ ] `dgadd remove ui/dialog --yes` removes the CSS chunks it owns (subject to the same reverse-dep / orphan rules).
- [ ] `dgadd diff` detects drift in CSS chunks (e.g., user edited a chunk).
- [ ] Existing CSS sentinel-marker idempotency tests still pass.

### General
- [ ] All existing tests still pass.
- [ ] No public CLI flag/command rename.
- [ ] Reverse-dep + orphan + diff scope changes are exercised via `cli-behavior.test.ts` spawn-based integration tests, not just unit tests.

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/registry build
pnpm --filter @diffgazer/add build
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/registry test
# Live repro (no commits):
rm -rf /tmp/dgadd-cli-verify && mkdir /tmp/dgadd-cli-verify
cd /tmp/dgadd-cli-verify
pnpm init -y && pnpm add -D vite @vitejs/plugin-react react react-dom typescript
pnpm add /Users/voitz/Projects/diffgazer-workspace/cli/add
mkdir src/components src/lib
# Set up minimal vite+ts config with @/* alias
echo '{"$schema":"https://diffgazer.com/schema/diffgazer.json","components":"src/components/ui","aliases":{"components":"@/components","utils":"@/lib/utils"}}' > diffgazer.json
pnpm exec dgadd add ui/dialog --yes
pnpm exec dgadd list --installed --all
pnpm exec dgadd remove ui/button --yes
# Must print "Keeping ui/button; still required by: ui/dialog"
ls src/components/ui/button/      # must still exist
pnpm exec dgadd remove ui/dialog --yes
# Must cascade-remove or prompt for orphans; manifest must be clean
echo "// drift" >> src/components/ui/shared/portal.tsx
pnpm exec dgadd diff
# Must detect drift
```

## Notes & references
- Spec 029 §CLI-001/002/003 documents the live repro and root-cause file:line refs.
- AGENTS.md "Registry, CLI, and Handoff": `dgadd remove must respect ownership metadata and must not remove copied shared dependencies still needed by retained installed items.`
- Existing keys→copy-mode-ui guard at `cli/add/src/commands/remove.ts:62-86` is the reference implementation pattern to generalize.
- TESTING.md: spawn-based integration tests via `execFileSync` for full lifecycle.

## Non-goals
- Do not add new public commands beyond what's needed (e.g., `dgadd prune` could be a follow-up, not required for this task).
- Do not change the manifest file format incompatibly — extend, don't replace.
- Do not touch the add workflow's atomic-write / rollback machinery.
- Do not modify the registry build pipeline.

## Design hints (non-binding)
- For reverse-dep: build a `Map<itemName, Set<dependentItemName>>` from `installedComponents` manifest entries' `registryDependencies`. Before deleting any file, check if any retained item has the candidate in its dep closure.
- For orphans: after computing the post-remove manifest, walk it. Any item with `installedAs: "transitive"` (or similar metadata you record at add-time) whose dependents are all removed becomes an orphan. User-explicit installs (recorded at add-time) are never auto-orphaned.
- For CSS chunks: extend the manifest entry with `cssChunks: string[]` listing the chunk markers/IDs this item wrote. Reverse-dep check applies to chunks too.
- For diff scope: replace `publicInstallNames().filter(isInstalled)` with `Object.keys(ctx.config.getManifestItems(cwd))`.
