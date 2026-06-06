# Deferred findings (carried forward across phases)

Source: Phase-1 validation wave (2026-06-05). These comment/prose/label-level staleness items were deferred out of the Phase-1 zero-logic-edit charter and are now closed or recorded below as accepted no-action notes. None affect compilation or tests.

## Stale comments / strings after Phase-1 renames (fix in final sweep)
- [x] DF-01 cli/diffgazer/src/app/providers/keyboard.tsx:6 — FIXED in Phase 4 cycle 3 (orchestrator): `@see` now points at `libs/keys/src/providers/keyboard.tsx`.
- [x] DF-02 libs/core/src/get-figlet.ts:10 — FIXED in final sweep: doc-comment now references `figlet-text.ts`.
- [x] DF-03 cli/add/src/utils/keys-copy-bundle.ts:145 — ALREADY CLEAN before final sweep: stale "Inlined from shared/registry-types.ts" prose no longer exists.
- [x] DF-04 apps/web/src/features/providers/hooks/use-list-navigation.ts:65-67 — FIXED in final sweep: comment now references `model-select-dialog/use-dialog-keyboard`.
- [x] DF-05 libs/core/src/navigation/group-menu-items.ts:37 — FIXED in final sweep: comment no longer references `home-menu.tsx`.
- [x] DF-06 libs/registry/src/testing/cli-detect.test.ts:15 — FIXED in final sweep: comment now references `cli/terminal`.
- [x] DF-07 cli/diffgazer/src/app/screens/settings/theme-preview.test.ts:6 — FIXED in final sweep: describe label now uses current concept name.
- [x] DF-08 cli/server/src/features/review/stream/steps.test.ts:4 — FIXED in final sweep: describe label now uses current concept name.
- [x] DF-09 libs/keys/docs/design/playground-research-prompt.md:15 — ALREADY CLEAN before final sweep: the old prompt file no longer exists and no docs prose references `src/providers/keyboard-provider.tsx`.
- [x] DF-10 TESTING.md:102 — FIXED in final sweep: path now references `libs/ui/testing/axe.ts`.
- [x] DF-11 libs/keys docs page slug `keyboard-provider` (libs/keys/docs/content/api/keyboard-provider.mdx + meta) — NO-ACTION in final sweep: this slug names the public `KeyboardProvider` API, not the implementation filename, so changing it would be a public docs URL rename with no stale content to fix.

## Accepted orchestrator deviations (recorded, not to revert)
- AD-01 cli/diffgazer/src/lib/servers/api.ts:60 — `args: ["tsx", "src/dev.ts"]` → `"src/serve.ts"`. Runtime spawn literal following T-142's dev.ts→serve.ts rename. Not an import line, but leaving it points the spawn at a nonexistent file (breaks smoke). Behavior-preserving by D7's "tree must compile and test green between phases".
- AD-02 cli/diffgazer/src/lib/servers/embedded.test.ts:26 — dynamic-import URL `./features/review/sessions.js` → `./features/review/stream/store.js` following T-140's move. Same rationale.
- AD-03 cli/server/src/shared/lib/config/store.ts — implementer (T-143) updated a doc-comment listing module names alongside import rewrites. Technically outside the Phase-1 line whitelist but accurate and an improvement; kept.
- AD-04 cli/server/src/shared/lib/review/analysis.ts:14,160,246 — T-401's implementer also replaced two inline pluralization ternaries with `pluralize()` from @diffgazer/core/strings. Beyond T-401's literal text but behavior-equivalent (validator-verified), completes the Phase-2 (2.E) pluralize-dedup convention already applied to sibling summary.ts:26. KEPT — reverting would reintroduce the exact slop class this run removes.

## No-action notes
- NA-01 cli/diffgazer/src/features/history/lib/history-footer.ts (+ history-run-mapping) — mild path-echo, but the names are verbatim spec-prescribed by T-134.
- NA-02 apps/docs/src/components/docs-mdx/blocks/index.ts re-aliases kept — T-119's narrative was internally contradictory; exported symbols are *Block, aliases preserve the public MDX names. Implementer's call validated as correct.
- NA-03 cli/add keys-copy-bundle.ts 2-hyphen basename — D1-acceptable (spec-prescribed by T-144, names a real concept).
- NA-04 generic assetsDir plumbing (sync.mjs collectAssetOutputErrors, docs-sync cpSync branch, validation.mjs branches) — runtime-dead for current libraries after T-504 removed the last assetsDir, but T-504 explicitly sanctioned keeping the generic optional capability (manifest-keyed, early-returns when absent). Spec contract wins over the delete-dead-code preference here.

## Untracked-required files (must be git-added on commit — for the final report)
- cli/server/src/shared/lib/config/setup-status.ts, cli/server/src/shared/lib/diff/total-stats.ts (Phase 2)
- libs/registry/src/testing/verify-rsc.test.ts (Phase 2 fix cycle)
- apps/docs/src/features/theme/tui-primitives.ts + tui-primitives.test.ts, apps/docs/scripts/generate-sections-with-index.mjs (Phase 2)
- apps/docs/content/docs/app/cli/ (index/init/add/list/diff/remove.mdx + meta.json — the canonical dgadd reference, Phase 5; verified not gitignored)
- Root/tooling handoff: `.dependency-cruiser.cjs`, `.editorconfig`, `.gitattributes`, `knip.json`, `deploy/landing-nginx.conf`, and `.nuke/2026-06-04-structure/` spec/progress/gate logs.
- Package-local generated-ignore files: `cli/add/.gitignore`, `libs/keys/.gitignore`, `libs/ui/.gitignore`.
- Phase 8/docs generated-site support: `apps/docs/scripts/generate-sitemap.ts`, `apps/docs/scripts/artifacts/docs-example-wiring.test.ts`, `apps/docs/src/test-setup.ts`, `apps/docs/tests/e2e/baselines/*-chromium-darwin.png`.
- New reusable test assertion helpers: `libs/ui/registry/testing/assertions.ts`, `libs/keys/src/testing/assertions.ts`, `libs/core/src/testing/assertions.ts`, `libs/registry/src/testing/assertions.ts`, `cli/server/src/testing/assertions.ts`.
- Public handoff artifacts and support: `libs/ui/public/r/aria.json`, `cli/add/src/utils/keys-copy-bundle.ts`, `cli/add/src/utils/keys-copy-bundle.test.ts`, `scripts/monorepo/artifacts/{fixture,sync,validation}.mjs`, `scripts/monorepo/artifacts/*.test.mjs`.
- Workspace discovery and NodeNext config support: `cli/server/src/features/review/context/workspace-discovery.ts`, `cli/server/src/features/review/context/workspace-discovery.test.ts`, `libs/core/tsconfig/node-nodenext.json`, `libs/core/tsconfig/node-nodenext-test.json`.
- All Phase-1/3/4 move/split destinations and Phase-7 docs cutover destinations across `apps/docs`, `apps/web`, `apps/landing`, `cli/add`, `cli/diffgazer`, `cli/server`, `libs/core`, `libs/keys`, `libs/registry`, and `libs/ui` (rename pairs tracked via git add -N rename-proof).
