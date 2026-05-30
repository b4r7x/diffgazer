# cli/add — Audit Findings

Date: 2026-05-28
Package: `@diffgazer/add` (`cli/add`)

## Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 1 | 1 NEW |
| Medium | 8 | 8 NEW |
| Low | 7 | 7 NEW |
| **Total** | **16** | **16 NEW** |

All findings are NEW.

---

## High

### [NEW] [error-handling] F145 — CSS chunk scratch directory cleanup uses `process.on('exit')` which is unreliable on uncaught exceptions

- **file:line:** `cli/add/src/commands/diff.ts:36-41`
- **What:** Temporary chunk directory cleanup scheduled via `process.on('exit')` may not fire if the process is killed by a signal or an uncaught exception before the `exit` event.
- **Why:** Cleanup tied to `process.on('exit')` is skipped on signal termination and on uncaught exceptions, so the temporary chunk directory can leak across runs.
- **How:** Prefer explicit cleanup after command execution, or wrap in `try`/`finally`. If background cleanup is needed, consider OS-level temp cleanup (systems auto-clean `/tmp`) or document the risk and expected cleanup mechanism.
- **Effort:** Medium

---

## Medium

### [NEW] [dry] F22 — Duplicate `sha256` implementation in cli/add commands

- **file:line:** `cli/add/src/commands/add/manifest.ts:14-16`, `cli/add/src/commands/remove.ts:19-21`
- **What:** The `sha256()` cryptographic hash function is defined identically and independently in two files. `manifest.ts` exports it (unused), and `remove.ts` defines its own private copy. Neither module imports the function from the other.
- **Why:** Duplicated logic must be kept in sync by hand; a change to the hashing scheme in one file silently diverges from the other.
- **How:** Extract `sha256` to a new file `cli/add/src/utils/hashing.ts` or `cli/add/src/utils/crypto.ts`. Export it from that file. Import in both `manifest.ts` and `remove.ts`. Remove the local definitions and the unused export from `manifest.ts`.
- **Effort:** Low

### [NEW] [dry] F136 — Duplicate `sha256` function defined in two files

- **file:line:** `cli/add/src/commands/remove.ts:19-21`
- **What:** `sha256()` is defined identically in both `remove.ts` and `manifest.ts`, creating code duplication.
- **Why:** Two copies of the same hashing function are a DRY violation that risks drift between the manifest writer and the remove path.
- **How:** Extract `sha256()` into a shared utils file (`cli/add/src/utils/hashing.ts` or similar) and import from both `remove.ts` and `manifest.ts`. Export it from `manifest.ts` if already public.
- **Effort:** Low

### [NEW] [dry] F137 — Duplicate functions `publicInstallNames` and `publicListNames`

- **file:line:** `cli/add/src/utils/namespaces.ts:32-48`
- **What:** `publicInstallNames()` and `publicListNames()` are identical functions that filter public UI items and keys hooks, returning the same namespaced names array.
- **Why:** Two identical functions covering the same concept duplicate logic and obscure whether the install and list contexts are meant to differ.
- **How:** Merge into a single function `publicAvailableNames()` and update callers in `list.ts`. If names differ per context, add an optional parameter to distinguish or confirm they genuinely need duplication with a clear comment explaining the distinction.
- **Effort:** Low

### [NEW] [architecture] F138 — Module-level mutable state in remove.ts for command workflow sequencing

- **file:line:** `cli/add/src/commands/remove.ts:174-180`
- **What:** Two module-level mutable variables (`activeCwd`, `preRemovalChunksByItem`) serve as a closure pattern to thread state between `requireConfig` → `getAllItems` → `expandRequestedNames` → `onAfterRemove`, relying on sequential process execution.
- **Why:** Module-level mutable state coupling callbacks together depends on the implicit assumption of one sequential CLI invocation per process; it is fragile under reuse or concurrency.
- **How:** Refactor the command object to accept a context parameter or options bag that flows through the callback chain (`requireConfig`, `getAllItems`, `expandRequestedNames`, `onAfterRemove`). Store `activeCwd` and `preRemovalChunksByItem` in a scoped object passed as part of the workflow context.
- **Effort:** Medium

### [NEW] [error-handling] F140 — Unreachable catch block suppresses errors silently

- **file:line:** `cli/add/src/commands/diff.ts:40`
- **What:** Empty catch block swallows `rmSync` errors on process exit cleanup without logging or any indication that cleanup failed.
- **Why:** A silent empty catch hides cleanup failures, making leaked scratch directories hard to diagnose.
- **How:** Add a comment explaining the intent (e.g., "Suppress cleanup errors on abnormal exit") and consider whether logging would help debugging. If `rmSync` failure is genuinely non-critical, document that explicitly.
- **Effort:** Low

### [NEW] [dry] F143 — `validateInstallNames` and `validateAnyInstallableName` are near-duplicates with different public/all item sources

- **file:line:** `cli/add/src/utils/namespaces.ts:58-96`
- **What:** Two validation functions follow identical structure, differing only in whether they validate against `getPublicItems()` or `getAllItems()`, and `publicKeysHookNames` vs `getKeysHookNames()`.
- **Why:** Parallel functions with the same structure duplicate validation logic and make the public-vs-all distinction implicit rather than explicit.
- **How:** Extract a shared helper `validateInstallNamesAgainst(names, uiNames, keyNames)` and call it from both functions. Or rename validate functions to clarify scope (`validatePublicInstallNames`, `validateAllInstallableNames`) and comment the distinction.
- **Effort:** Low

### [NEW] [dry] F244 — Duplicate `sha256` hash function across files

- **file:line:** `cli/add/src/commands/remove.ts:19-21`
- **What:** `sha256()` function defined identically in both `remove.ts` (line 19) and `manifest.ts` (line 14). Both implementations use `node:crypto` to compute SHA256 hashes with the same signature and behavior.
- **Why:** The same hashing routine living in two modules is a DRY violation; one copy can change without the other.
- **How:** Export `sha256` from `manifest.ts` and import it in `remove.ts`. Since `manifest.ts` already exports it, add `import { sha256 } from './add/manifest.js';` at line 14 and delete the function definition at lines 19-21.
- **Effort:** Low

### [NEW] [architecture] F245 — Mutable module-level state in remove command workflow

- **file:line:** `cli/add/src/commands/remove.ts:174,180`
- **What:** Two module-level `let`-scoped variables (`activeCwd`, `preRemovalChunksByItem`) used as inter-callback communication in the `removeCommand` workflow. These are global state that relies on sequential CLI invocation per process.
- **Why:** Global mutable state shared between workflow callbacks couples them through process-lifetime variables and breaks if the workflow is ever invoked concurrently or reused.
- **How:** Refactor `removeCommand` configuration to pass these through the workflow API rather than closure variables. If the registry/cli API doesn't support it, document with a clearer comment linking to the sequential constraint, and consider wrapping in an instance or request scope.
- **Effort:** Medium

---

## Low

### [NEW] [dead-code] F23 — Unused export of `sha256` from manifest module

- **file:line:** `cli/add/src/commands/add/manifest.ts:14-16`
- **What:** The `sha256` function is exported from `manifest.ts` but never imported by any consumer (verified by grep). It is an unused public API.
- **Why:** An exported-but-unused function is dead surface area that misleads readers into thinking it is part of the module's contract.
- **How:** Remove the `export` keyword from the `sha256` function in `manifest.ts` (make it private). Once extracted to a shared utility, remove this local definition entirely.
- **Effort:** Low

### [NEW] [architecture] F139 — Module-level mutable caches without clear lifetime

- **file:line:** `cli/add/src/utils/integration.ts:24`; `cli/add/src/utils/transform.ts:211-212`; `cli/add/src/commands/diff.ts:35`
- **What:** Three module-level caches (`cachedCopyBundle`, `_keysHookFiles`, `_reLocalHookImport`, `chunkScratchDir`) initialized to `null` and lazily populated, persisting for the process lifetime.
- **Why:** Lazily populated process-lifetime caches without a stated policy leave their lifecycle and invalidation rules unclear to future maintainers.
- **How:** For long-lived caches (`copyBundle`, `keysHookFiles`), document the cache policy in a comment (e.g., "Cached for process lifetime"). For temporary state (`chunkScratchDir`, regex), use a class or function factory to encapsulate lifecycle if reused across multiple invocations, or ensure cleanup is deterministic. Consider whether caching is necessary or if load times are acceptable.
- **Effort:** Medium

### [NEW] [kiss] F141 — Ternary expression chains reduce readability

- **file:line:** `cli/add/src/commands/remove.ts:206-208`
- **What:** Complex nested ternary determines `keyName`: `parsed.namespace === "keys" ? parsed.name : getKeysHookNames().has(item.name) ? item.name : null`.
- **Why:** Nested ternaries obscure the branching logic and are harder to read and modify than explicit control flow.
- **How:** Rewrite with explicit `if`/`else` or early return: `if (parsed.namespace === 'keys') return parsed.name; if (getKeysHookNames().has(item.name)) return item.name; return null;` (in a helper function if this pattern is reused).
- **Effort:** Low

### [NEW] [performance] F142 — RegExp created fresh inside tight loops

- **file:line:** `cli/add/src/utils/transform.ts:153-157`
- **What:** `rewriteRelativeJsExtensionsForCopy` creates a new `RegExp` on every call, using a template with the `IMPORT_PREFIX` constant. No memoization or static compilation.
- **Why:** Recompiling the same regex on every invocation wastes work when the pattern is constant and the function runs repeatedly.
- **How:** Move RegExp to module level (`const RELATIVE_JS_IMPORT_RE = new RegExp(...)`) or inline the regex literal if simple enough. Same pattern for other regex in this file (`rewriteKeysPackageImportLine:173`, `parseKeysImportLine` uses `getLocalHookImportRegex()`).
- **Effort:** Low

### [NEW] [type-safety] F144 — No exhaustiveness check on `IntegrationMode` string union

- **file:line:** `cli/add/src/utils/add-integration.ts:53-82`
- **What:** `resolveIntegrations` function handles `'ask'`, `'none'`, `'copy'`, `'@diffgazer/keys'` modes but uses `if`/`else` without a TypeScript exhaustiveness pattern to catch missing cases.
- **Why:** Without an exhaustiveness check, adding a new union member compiles silently and falls through unhandled rather than producing a type error.
- **How:** Use a `switch` statement on `mode` instead of `if`/`else`, and let TypeScript enforce exhaustiveness. Alternatively, add a `const exhaustiveCheck: never = mode` check at the end of the `if` chains.
- **Effort:** Low

### [NEW] [dry] F246 — Undocumented inlined string utility duplicated from libs/ui

- **file:line:** `cli/add/src/utils/transform.ts:9`
- **What:** `escapeForRegex` function is inlined in `transform.ts` (line 9) with a comment claiming it's duplicated from `shared/string-utils.ts` because 'CLI rootDir: "src" prevents external imports'. The same function exists in `libs/ui/shared/string-utils.ts` but is not imported.
- **Why:** A copy of a shared utility duplicated across package boundaries can drift from its source, and the justification lives only in an inline comment rather than documented architecture.
- **How:** Either: (1) If the `rootDir` constraint can be revisited, move `escapeForRegex` to `@diffgazer/core/strings` and import it; (2) If `rootDir` is binding, add explicit documentation in `ARCHITECTURE.md` explaining why this duplication is accepted, and link to it from the comment.
- **Effort:** Low

### [NEW] [architecture] F247 — Private module-level cache state in transform.ts without lifecycle clarity

- **file:line:** `cli/add/src/utils/transform.ts:211-212`
- **What:** Two module-level `let` variables (`_keysHookFiles`, `_reLocalHookImport`) cache regex and hook names with `null` initialization and lazy population. No explicit cache lifecycle or reset mechanism.
- **Why:** Lazily populated caches with no documented invalidation rule are correct only under an unstated assumption (the bundle is loaded once and never mutated), which is invisible to future maintainers.
- **How:** Add a comment above lines 211-212 documenting that: (1) the cache is safe because the copy-bundle is loaded once at startup and never mutated; (2) no manual reset is needed; (3) if future changes allow runtime bundle reload, cache invalidation must be added. Alternatively, consider a `CachedValue<T>` class with a `clear()` method for clarity.
- **Effort:** Low
