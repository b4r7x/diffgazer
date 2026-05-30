# Findings: handoff-3paths

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 2 | 0 | 2 | 0 |
| Medium | 8 | 0 | 8 | 0 |
| Low | 6 | 0 | 6 | 0 |
| **Total** | **16** | **0** | **16** | **0** |

---

## Critical

_No critical findings._

---

## High

### F186 — [NEW] [handoff] .js import specifiers not stripped in keys copy-mode bundle generation

- **file:line** — `cli/add/scripts/generate-keys-copy-bundle.ts:9-18`
- **What** — The `rewriteHookInternalImports` function rewrites relative paths (../core/ → ./utils/) but does NOT strip .js extensions from relative imports. Keys hooks in the generated copy bundle (cli/add/src/generated/keys-copy-bundle.json) still contain specifiers like `from "./utils/navigation-dispatch.js"` which violates PROJECT RULES: 'copy-mode UI must rewrite package imports to local copied paths' and…
- **Why** — Emitting `.js` specifiers in the copy bundle breaks copy/shadcn consumers and violates the documented handoff contract for copy-mode imports.
- **How** — Apply the `rewriteRelativeJsExtensionsForCopy` function from cli/add/src/utils/transform.ts (which already implements the regex pattern for stripping .js extensions) to the keys copy bundle content during generation. Call this function in the `rewriteHookInternalImports` callback or add a separate post-processing step.
- **Effort** — low

### F188 — [NEW] [handoff] Registry bundle generation does not validate .js extension stripping for UI components

- **file:line** — `cli/add/scripts/bundle-registry.ts`
- **What** — The registry bundle generation (cli/add/src/generated/registry-bundle.json) is not validated to ensure all relative imports have .js extensions stripped. Unlike the keys copy bundle which has the rewriteHookInternalImports function, the UI registry bundle generation does not apply rewriteRelativeJsExtensionsForCopy to registry items before bundling, though this is a secondary concern since UI item…
- **Why** — Without a validation gate, `.js` specifiers can slip into the registry bundle undetected and break copy/shadcn consumers at install time.
- **How** — Add a validation check in validate-artifacts.mjs to scan registry and keys copy bundles for .js import specifiers and fail if found. Alternatively, ensure bundle generation scripts apply the .js-stripping transform. Most critical: fix the keys bundle generation at cli/add/scripts/generate-keys-copy-bundle.ts.
- **Effort** — medium

---

## Medium

### F58 — [NEW] [reusability] Dialog-Content uses @/lib/aria-utils but aria-utils not in public exports

- **file:line** — `libs/ui/registry/ui/dialog/dialog-content.tsx:17`
- **What** — dialog-content.tsx imports `mergeIds` from `@/lib/aria-utils`, but aria-utils is not listed in package.json exports. When copied via dgadd into projects, the @/lib import rewrites work, but aria-utils is not registered as a shared utility in the registry.
- **Why** — An unregistered shared utility can be installed inconsistently or duplicated across the three install paths, breaking the single-source copy contract.
- **How** — Add a 'aria-utils' registry:lib item that exports mergeIds and any other merged utility functions. Update dialog-content and other consumers to list it in registryDependencies. Verify smoke:shadcn and smoke:cli both install aria-utils only once.
- **Effort** — medium

### F59 — [NEW] [architecture] Portal component uses typeof document check but not guarded for SSR

- **file:line** — `libs/ui/registry/ui/shared/portal.tsx:26`
- **What** — Portal checks `typeof document !== 'undefined'` but returns null, potentially breaking SSR contexts. When rendered server-side (e.g., Next.js app router), Portal silently renders nothing instead of a hydration-safe marker or error boundary.
- **Why** — Silently rendering nothing on the server is not hydration-safe and is not caught by the SPA smoke tests, so SSR consumers hit it only in production.
- **How** — Either: (1) suppress SSR rendering with 'use client' + lazy import guard, (2) use a hydration-safe SSR wrapper that renders to a stable placeholder, or (3) document that Portal is client-only and consumers must lazy-load it. Check floating-panel/popover smoke tests under SSR (apps/web is Vite SPA, not server-rendered, so this is not caught).
- **Effort** — medium

### F62 — [NEW] [reusability] Missing registry:lib entry for shared utility functions used across components

- **file:line** — `libs/ui/registry/registry.json`
- **What** — Several shared utilities are imported by multiple components but have no explicit registry:lib entry. Examples: aria-utils (mergeIds), input-variants, compose-refs. These are listed in registryDependencies as bare names but do not appear as registry items.
- **Why** — Dependencies referenced by name but absent from the registry cannot resolve through every install path and may be copied more than once.
- **How** — Add registry:lib items for aria-utils, input-variants, and any other shared lib functions. Update their consumers' registryDependencies to reference the lib item. Regenerate public registry and smoke-test that a multi-component install only copies each lib once.
- **Effort** — high

### F189 — [NEW] [handoff] Missing validation of registry item completeness in smoke tests

- **file:line** — `scripts/monorepo/smoke-shadcn-install.mjs:112-161`
- **What** — The smoke test suite checks that registry items exist (assertRegistryItemsExist) and have no .js import specifiers (assertNoJsImportSpecifiers), but does NOT validate that all files in a registry item are properly included or that registryDependencies are complete. For example, a UI component might list a dependency on another UI component that has not been added to the registry JSON yet, or a hoo…
- **Why** — Without a dependency-closure check, an incomplete registry item passes smoke tests but fails for consumers when a referenced dependency or file is missing.
- **How** — Add a smoke test that: (1) for each registry item, load all its registryDependencies recursively; (2) verify that all listed files exist in the files array; (3) type-check the resolved files to ensure no broken imports. This can be done by walking the dependency graph and verifying closure at install time (smoke-shadcn-install.mjs).
- **Effort** — medium

### F302 — [NEW] [dry] Code duplication: escapeForRegex defined in cli/add instead of reusing libs/ui/shared

- **file:line** — `cli/add/src/utils/transform.ts:8-9`
- **What** — The function escapeForRegex is locally redefined in cli/add/src/utils/transform.ts (line 9) instead of importing from libs/ui/shared/string-utils.ts which already exports this exact function.
- **Why** — Re-defining a utility that already exists duplicates logic and lets the two copies drift apart.
- **How** — Move escapeForRegex into a shared location (e.g., libs/registry/src/utils/string-utils.ts) accessible to both cli/add and any other packages, then import it in cli/add/src/utils/transform.ts line 9. Update the tsconfig.json rootDir if needed to enable the import.
- **Effort** — low

### F304 — [NEW] [error-handling] Missing error context when transform.ts rewriteLocalImportsForKeysPackage fails silently on unknown imports

- **file:line** — `cli/add/src/utils/transform.ts:200-204`
- **What** — Function rewriteLocalImportsForKeysPackage (line 200) silently passes through unknown import specifiers to the fallback `import { ... } from @diffgazer/keys` statement without logging or warning about the specifiers that were not successfully rewritten. This can hide typos or incomplete migrations.
- **Why** — Silently passing through unrecognized specifiers hides typos and incomplete migrations until they surface as broken imports downstream.
- **How** — Add logging or throw an error when `unknown.length > 0` to surface the mismatch. Alternatively, validate hook names at the CLI layer before invoking the transform, so copy-mode validation catches the error earlier.
- **Effort** — low

### F306 — [NEW] [handoff] Missing validation of peerDependenciesMeta consistency in @diffgazer/ui exports

- **file:line** — `libs/ui/package.json:331-348`
- **What** — @diffgazer/ui declares @diffgazer/keys as peerDependency with optional=true (line 339-341), but the registry system does not validate that all exported components declaring @diffgazer/keys registryDependencies also declare the peer as optional. This can lead to incorrect install instructions in dgadd.
- **Why** — An unchecked mismatch between registry dependencies and peerDependenciesMeta can produce incorrect install instructions for package consumers.
- **How** — Add validation in validate-registry-metadata.ts to check that for any non-hidden registry item with @diffgazer-keys/* registryDependencies, the package.json peerDependenciesMeta['@diffgazer/keys'] has optional=true. Document this constraint in AGENTS.md.
- **Effort** — medium

### F310 — [NEW] [tests] Smoke test smoke-cli.mjs does not verify that copy-mode @/hooks imports are actually available after install

- **file:line** — `scripts/monorepo/smoke-cli.mjs:289-316`
- **What** — The copy-first smoke test (line 283-320) validates that dgadd init/add/remove flows work and that diffgazer.json manifest is correct, but does not actually import and call the copied hooks from the fixture app to verify they are functional and correctly rewritten for the target environment.
- **Why** — Verifying flow and manifest but never exercising the copied hooks leaves the import-rewrite correctness untested, so broken rewrites pass the smoke gate.
- **How** — Add a step after writeCopyFirstApp (line 295) that attempts to import the hooks from the test app (e.g., `const { useNavigation } = await import('./dist/hooks/use-navigation.js')`) to verify the import path rewrite actually works. Or extend the build/typecheck steps to exercise the imports.
- **Effort** — medium

---

## Low

### F63 — [NEW] [security] No runtime verification of integrity hash in keys-copy-bundle

- **file:line** — `cli/add/src/generated/keys-copy-bundle.json`
- **What** — keys-copy-bundle.json includes an integrity field (SHA256 hash), but the dgadd CLI does not verify it during install. If the bundle is corrupted or tampered with, copy-mode users will silently install broken code.
- **Why** — An integrity field that is never checked provides no protection; corrupted or tampered bundles install silently.
- **How** — Add a CLI verification step: when loading keys-copy-bundle.json, compute the hash of items and compare to the integrity field. Throw a clear error if mismatch detected. Also verify in smoke:cli test that tampering is detected.
- **Effort** — medium

### F190 — [NEW] [dead-code] Registry 'theme' item not exported from @diffgazer/ui package.json

- **file:line** — `libs/ui/package.json:276-280`
- **What** — The registry.json contains a 'theme' item with type 'registry:theme', but the package.json exports at line 276 exports './theme-base.css' and './theme.css' as direct CSS files rather than './components/theme' or './theme' as a registry component export. The validate-artifacts script hardcodes theme-base.css, theme.css, sources.css, and styles.css as expected exports (line 90-93) but there is no co…
- **Why** — A registry item with no matching package export is either unreachable through the package path or should be marked internal; the mismatch is unclear.
- **How** — Verify if 'theme' registry item should be hidden (mark meta.hidden: true in registry.json) or if a './theme' export should be added to package.json pointing to a theme component or index. Most likely the theme item is intentionally internal/hidden and should be marked as such. Confirm in AGENTS.md the intent.
- **Effort** — low

### F303 — [NEW] [kiss] Inefficient code path in prepareFileContentForIntegration wrapper

- **file:line** — `cli/add/src/utils/registry.ts:54-66`
- **What** — Function prepareFileContentForIntegration (line 54) always routes through prepareFileContent after applying integration-mode-specific rewrites, unnecessarily duplicating the CSS_SIDE_EFFECT_IMPORT_RE and whitespace normalization work when integrationMode is 'none' (the majority case for non-keys components).
- **Why** — Re-running the CSS and whitespace normalization on the common 'none' path repeats work and obscures the control flow.
- **How** — Inline the prepareFileContent logic into prepareFileContentForIntegration so the CSS/whitespace steps are applied only once, and the rewrite branches are more obvious. Alternatively, make prepareFileContent accept an optional pre-transformed content parameter to avoid re-normalizing.
- **Effort** — low

### F307 — [NEW] [reusability] Duplicate keys hook file content logic in buildKeysFileOps without clear ownership

- **file:line** — `cli/add/src/commands/add/file-ops.ts:72-101`
- **What** — Function buildKeysFileOps (line 53-104) contains deduplication logic (lines 72-101) that merges multiple sources of the same hook file (e.g., when multiple UI components pull in the same keys utility). This logic is inlined and not shared with the registry or copy-bundle builder.
- **Why** — Inlining the merge logic instead of sharing it means the same deduplication can diverge between the file-ops path and the copy-bundle builder.
- **How** — Extract the deduplication logic into a shared function in libs/registry/src (e.g., mergeCopyBundleFiles) that accepts an array of files and returns a deduplicated map by target path, then use it in both buildKeysFileOps and any other copy-bundle merge points.
- **Effort** — medium

### F308 — [NEW] [anti-slop] transform.ts rewriteLocalImportsForKeysPackage caches regex but does not invalidate on runtime state changes

- **file:line** — `cli/add/src/utils/transform.ts:211-231`
- **What** — Module-level cached variables _keysHookFiles and _reLocalHookImport (lines 211-212) are populated on first call to getKeysHookFilesSet() (lines 214-219) and getLocalHookImportRegex() (lines 221-231). If the bundled keys copy is rebuilt, the cache is never cleared, causing stale regex patterns and hook names to be used in subsequent transforms within the same process.
- **Why** — A module-level cache that is never invalidated can serve stale hook names and regex patterns if the bundle changes within the same process.
- **How** — Replace the module-level cache with an invalidatable cache pattern, or fetch getKeysHookImportNames() fresh each time (perf is acceptable since the bundle is small). Document the caching behavior in a comment if it is intentional for single-shot CLI usage.
- **Effort** — low

### F309 — [NEW] [tests] Missing test coverage for copy-mode import rewrite edge case: specifiers with 'type' keyword

- **file:line** — `cli/add/src/utils/transform.ts:160-170`
- **What** — Function renderImport (lines 167-170) always places 'type' prefix handling inside the specifier string, but the caller buildConsolidatedImport (line 274) conditionally adds 'type' prefix to specs. The interaction between these two is not directly tested for correctness when rewriteLocalImportsForKeysPackage is called on file content with mixed value and type imports from local hooks.
- **Why** — The untested interaction between per-specifier and consolidated 'type' handling can silently emit a duplicated 'type' keyword on mixed imports.
- **How** — Add a test case in cli/add/src/utils/transform.test.ts that verifies rewriteLocalImportsForKeysPackage correctly consolidates mixed type and value imports from @/hooks paths without duplicating the 'type' keyword.
- **Effort** — low

---
