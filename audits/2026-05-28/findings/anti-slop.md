# Findings: anti-slop

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 4 | 0 | 4 | 0 |
| Medium | 2 | 0 | 2 | 0 |
| Low | 3 | 0 | 3 | 0 |
| **Total** | **9** | **0** | **9** | **0** |

---

## Critical

_No critical findings._

---

## High

### F94 — [NEW] [dry] Duplicate registry files across libs and apps (DRY violation)

- **file:line** — `libs/ui/registry, apps/docs/registry`
- **What** — 604 identical registry source files are maintained in parallel: libs/ui/registry/ and apps/docs/registry/. These files are byte-identical (verified via md5sum), including hooks, components, component-docs, lib utilities, and examples.
- **Why** — Maintaining 604 byte-identical files in two trees guarantees they drift apart and doubles the cost of every change.
- **How** — The apps/docs/registry directory should be generated from libs/ui/registry artifacts or symlinked, rather than maintained as a duplicate copy. Alternatively, refactor the build system so the docs app imports from the library's published exports or a shared registry package, eliminating the need for parallel source trees. Verify that the artifact sync system covers all necessary outputs (generated …
- **Effort** — high

### F95 — [NEW] [anti-slop] Verbose singleton forwarder exports (anti-slop: repetitive boilerplate)

- **file:line** — `cli/server/src/shared/lib/config/store.ts:517-530`
- **What** — 14 consecutive export declarations (lines 517-530) follow the same verbose pattern: `export const NAME: ConfigStore["NAME"] = (...args) => getStore().NAME(...args);`. Each export is a trivial forwarder that adds 0 semantic value beyond duplicating the interface signature.
- **Why** — Fourteen hand-written forwarders restate the interface signature with no added meaning, inflating the surface that must be kept in sync.
- **How** — Replace the 14 export lines with a helper that generates forwarders dynamically, or export the result of createConfigStore() directly and let consumers call methods on that. If API stability requires exporting top-level functions, use a code-generation tool or reduce the 14 lines to 1-2 that describe the contract generically rather than repeating it per method.
- **Effort** — low

### F338 — [NEW] [dry] Massive code duplication: 600+ identical files copied between libs/ui and apps/docs registries

- **file:line** — `libs/ui/registry/ui, apps/docs/registry/ui`
- **What** — Complete registry components, hooks, and docs are identically duplicated across two package directories. Examples: all menu component files (menu.tsx, menu-item.tsx, menu-sub.tsx, etc.), select components (select.tsx, select-content.tsx, etc.), use-listbox.ts (436 LOC), use-floating-position.ts (312 LOC), use-outside-click.ts (280 LOC), and all component-docs files (menu.ts, select.ts, sidebar.ts,…
- **Why** — Hundreds of duplicated component and hook files create two divergent sources of truth, so fixes and updates must be applied twice and silently rot.
- **How** — Move all shared components, hooks, and docs to @diffgazer/ui as the single source. Have @diffgazer/docs import and re-export from @diffgazer/ui. Update registry build tooling to reference single source. Update package.json exports for docs to point to ui exports. Remove duplicate files from apps/docs/registry.
- **Effort** — high

### F339 — [NEW] [anti-slop] Verbose lazy singleton pattern with 13 boilerplate wrapper exports

- **file:line** — `cli/server/src/shared/lib/config/store.ts:510-530`
- **What** — Lines 510-530: The store implements a lazy singleton (_store) followed by 13 wrapper functions that all follow the pattern: `export const funcName: ConfigStore['funcName'] = (...args) => getStore().funcName(...args);`. This pattern adds 13 lines of boilerplate that could be eliminated.
- **Why** — Thirteen mechanical wrapper functions add boilerplate that mirrors the interface without contributing behavior, increasing maintenance overhead.
- **How** — Export getStore() as a public function (or use a module-level re-export of the interface). Consumers import ConfigStore type and call getStore().method() directly, or use a namespace re-export: `export * as config from './store-impl.js'` pattern. Eliminates wrapper functions entirely.
- **Effort** — low

---

## Medium

### F208 — [NEW] [dead-code] Duplicated escapeForRegex function

- **file:line** — `cli/add/src/utils/transform.ts:9`
- **What** — The function escapeForRegex is defined inline with a comment stating it's duplicated from libs/ui/shared/string-utils.ts because CLI's rootDir prevents external imports. However, this creates maintenance burden if the regex escaping logic needs to be updated.
- **Why** — Copying escapeForRegex into the CLI means the two copies can diverge whenever the escaping logic changes.
- **How** — Extract escapeForRegex to a shared utility package that both cli/add and libs/ui can depend on (e.g., @diffgazer/core), or reconfigure cli/add's build to allow imports from libs/ui/shared via a proper package export. Update the single definition and import it.
- **Effort** — low

### F340 — [NEW] [dry] Repetitive object key aggregation with three identical forEach loops

- **file:line** — `cli/server/src/features/review/context.ts:125-134`
- **What** — Lines 125-134: Three nearly identical forEach loops aggregate keys from dependencies, devDependencies, and peerDependencies into a Set. Each repeats: `Object.keys(pkgJson.X ?? {}).forEach((dep) => dependencies.add(dep))`.
- **Why** — Three copy-pasted loops differing only in the source key are harder to read and edit than one parameterized step.
- **How** — Extract a helper: `const addDepsFromSection = (section?: Record<string, string>) => { Object.keys(section ?? {}).forEach(dep => dependencies.add(dep)); }`. Then call it 3 times: `addDepsFromSection(pkgJson.dependencies); addDepsFromSection(pkgJson.devDependencies); addDepsFromSection(pkgJson.peerDependencies);` Or use Array.from(new Set([...Object.keys(d), ...Object.keys(dd), ...Object.keys(pd)]))…
- **Effort** — low

---

## Low

### F96 — [NEW] [error-handling] Console.warn inside async error handler (error handling smell)

- **file:line** — `cli/server/src/shared/lib/config/store.ts:267-269`
- **What** — Inside the async updateSettings() method, a catch block calls console.warn() to log a non-fatal error during secrets file deletion after migration. The warning is not structured and is lost if the caller does not have a console attached.
- **Why** — An unstructured console.warn buried in a method gives callers no way to observe or react to the failure.
- **How** — Either (1) return a Result from persistTrust() and let callers decide to log/warn, or (2) use a structured logger passed via context, or (3) collect the error and return it as part of the ok() result so callers can decide how to handle the warning. Ensure the error is not silently swallowed in production.
- **Effort** — low

### F209 — [NEW] [dead-code] Unused escapeForRegex export in libs/ui

- **file:line** — `libs/ui/shared/string-utils.ts:1-3`
- **What** — The function escapeForRegex is exported from libs/ui/shared/string-utils.ts but is not imported or used anywhere within the @diffgazer/ui package itself. No registry items or utilities reference it.
- **Why** — An export with no internal consumers and no public-contract role is dead weight that obscures what the package actually uses.
- **How** — Either: (1) Delete the file if it was meant as a temporary utility, (2) Add it to libs/ui's public exports and document it in the registry if it's meant for external consumers, or (3) Use it internally to remove the duplication in cli/add/src/utils/transform.ts.
- **Effort** — low

### F341 — [NEW] [public-api] No public-api consistency: wrapper exports re-type ConfigStore methods instead of deriving from interface

- **file:line** — `cli/server/src/shared/lib/config/store.ts:517-530`
- **What** — Lines 517-530 re-type each wrapper export explicitly (e.g., `export const getSettings: ConfigStore['getSettings']`) rather than using a unified pattern. If ConfigStore is updated, all 13 type annotations must be manually maintained.
- **Why** — Manually re-typing each export against ConfigStore means the public surface must be hand-synced whenever the interface changes.
- **How** — Use a namespace: `export const configAPI = createConfigStore()` and let consumers call it, or use a const assertion pattern. Alternatively, define a single factory function that returns all exports, ensuring type safety automatically.
- **Effort** — low
