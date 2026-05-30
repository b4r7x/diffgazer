# Findings: libs-registry

`@diffgazer/registry`

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 2 | 0 | 2 | 0 |
| Medium | 8 | 0 | 8 | 0 |
| Low | 4 | 0 | 4 | 0 |
| **Total** | **14** | **0** | **14** | **0** |

---

## Critical

_No critical findings._

---

## High

### F121 — [NEW] [type-safety] Type assertion bypass in compareItemFields without narrowing

- **file:line** — `libs/registry/src/shadcn/validate.ts:64-67`
- **What** — compareItemFields uses `field as keyof RegistryItem` to access properties, but `actualItem` is typed as `Partial<Record<keyof RegistryItem, unknown>>`. The assertion allows unsafe index access without proper type guards, relying on runtime shape matching.
- **Why** — Asserting the key type without verifying the value shape lets a malformed `actualItem` pass comparison silently, undermining the registry validation it is meant to enforce.
- **How** — Introduce a type guard or validation function to check that actualItem conforms to RegistryItem shape before field comparison, or refactor compareItemFields to accept both items with the same type signature and validate schema conformance upfront in validatePublicRegistryFresh.
- **Effort** — medium

### F128 — [NEW] [error-handling] resetDir silently destroys content without transaction semantics

- **file:line** — `libs/registry/src/utils/fs.ts:41-44`
- **What** — resetDir calls rmSync with force: true and then mkdirSync. If mkdirSync fails after rmSync, the directory is left deleted with no recovery mechanism. Callers do not receive feedback about partial failures.
- **Why** — A failure between the delete and recreate steps leaves the target directory gone with no signal to the caller, so a partial failure looks like success while data is lost.
- **How** — Wrap resetDir in a try-catch that re-creates the directory on mkdirSync failure, or return a result type indicating success/failure. Alternatively, mkdirSync with recursive:true will not fail if the directory is empty, so document that assumption. Consider using fs.promises for async cleanup.
- **Effort** — medium

---

## Medium

### F120 — [NEW] [dry] Duplicate validator function across docs modules

- **file:line** — `libs/registry/src/docs/index.ts:15-18`
- **What** — assertSafeLibraryId is defined identically in both docs/index.ts and docs/sync-operations.ts (lines 15-18 in index.ts and 16-19 in sync-operations.ts), plus a duplicate regex SAFE_LIBRARY_ID_RE
- **Why** — Two copies of the same security-relevant validator can drift apart, leaving one path with weaker library-id checks than the other.
- **How** — Extract assertSafeLibraryId and SAFE_LIBRARY_ID_RE to a shared module (e.g., docs/validators.ts or docs/utils.ts) and import in both docs/index.ts and docs/sync-operations.ts.
- **Effort** — low

### F122 — [NEW] [error-handling] Silent logger.warn and logger.debug calls without guaranteed definition

- **file:line** — `libs/registry/src/fingerprint.ts:13`
- **What** — computeInputsFingerprint accepts a Logger parameter with optional warn and debug methods, but callers may pass defaultLogger or a partial logger. The optional chaining `logger.warn?.()` masks potential issues if warn is undefined when called via a consumer that expects warnings to be emitted.
- **Why** — Optional logging methods silently no-op when absent, so a consumer expecting warnings may never see them and miss real fingerprint mismatches.
- **How** — Either (a) make Logger.warn and Logger.debug required and always provide implementations (including no-op defaults), or (b) document that optional methods will not emit and provide a strict logger factory that enforces all methods. Consider using a discriminated union Logger type or a factory pattern.
- **Effort** — low

### F123 — [NEW] [dry] Unshared registry validation schema creates maintenance risk

- **file:line** — `libs/registry/src/registry-types.ts:10-11`
- **What** — A comment notes that RegistryItemSchema in registry-types.ts is 'near-identical' to a schema in src/cli/registry.ts and is intentionally duplicated due to different validation needs. However, no automated verification ensures these schemas remain in sync when registry items evolve.
- **Why** — Without automated verification, the two near-identical schemas can diverge as registry items evolve, accepting or rejecting items inconsistently across paths.
- **How** — Extract common RegistryItemSchema fields into a base schema module (e.g., registry-base-schema.ts), import it in both registry-types.ts and cli/registry.ts, and extend with divergent fields in each. Add a test that validates both schemas are semantically compatible for core fields.
- **Effort** — medium

### F125 — [NEW] [dry] assertSafeLibraryId validation called redundantly in both docs/index.ts and docs/sync-operations.ts

- **file:line** — `libs/registry/src/docs/index.ts:38-40 and libs/registry/src/docs/sync-operations.ts:284-287`
- **What** — syncDocsFromArtifacts in docs/index.ts validates the primary library ID and all library IDs (lines 38-40). Then runDocsSyncPass in docs/sync-operations.ts validates them again (lines 284-287). The same validation is performed twice in a sequential call chain.
- **Why** — Re-validating the same IDs in a sequential call chain is redundant work and leaves the validation contract between the two functions undocumented.
- **How** — Remove the duplicate assertions from runDocsSyncPass and rely on syncDocsFromArtifacts validation. Document that runDocsSyncPass expects pre-validated IDs. If runDocsSyncPass is used from other call sites, add a single validation at its public API boundary.
- **Effort** — low

### F126 — [NEW] [type-safety] Partial<Record<keyof T, unknown>> pattern hides shape contract in validate.ts

- **file:line** — `libs/registry/src/shadcn/validate.ts:59`
- **What** — compareItemFields accepts `actualItem: Partial<Record<keyof RegistryItem, unknown>>` which allows arbitrary keys and unknown values. This type is too loose and doesn't enforce that actualItem is structurally compatible with RegistryItem.
- **Why** — A too-loose type lets the compiler accept arbitrary keys and values, so structural mismatches with RegistryItem go undetected until runtime.
- **How** — Define actualItem as a Partial<RegistryItem> (which enforces key names and allows any subset) rather than a Record. This way, TypeScript ensures only valid RegistryItem keys are present and enables better IDE autocomplete and error checking.
- **Effort** — low

### F230 — [NEW] [dry] Duplicated SAFE_LIBRARY_ID_RE constant across docs modules

- **file:line** — `libs/registry/src/docs/index.ts:13, libs/registry/src/docs/sync-operations.ts:14`
- **What** — The same regex pattern `^[a-z0-9][a-z0-9-]*$` and `assertSafeLibraryId()` function are defined identically in two files: docs/index.ts and docs/sync-operations.ts.
- **Why** — Duplicating the validation regex in two files invites drift, so the allowed library-id format could silently differ between modules.
- **How** — Extract SAFE_LIBRARY_ID_RE and assertSafeLibraryId() into a new file like docs/library-id-validation.ts and import from both docs/index.ts and docs/sync-operations.ts.
- **Effort** — low

### F233 — [NEW] [type-safety] metaField function uses type-gymnastic pattern with fallback type narrowing

- **file:line** — `libs/registry/src/cli/registry.ts:198-218`
- **What** — The metaField function accepts a generic T constrained to string | number | boolean | string[], then uses a switch statement on typeof fallback to narrow the return type. However, the switch does not have an exhaustive handler for string[] (default case returns fallback), which could silently return the wrong type if the constraint is violated.
- **Why** — The non-exhaustive switch routes the string[] case to the default branch, so a constraint violation can silently yield a value of the wrong type instead of failing.
- **How** — Restructure to use discriminated types or rewrite using overloads for each specific T (string, number, boolean, string[]). Add explicit type guard for Array.isArray(val) when T extends string[] to ensure correct narrowing.
- **Effort** — medium

### F235 — [NEW] [dry] Duplicated RegistryItemSchema validation across registry-types.ts and cli/registry.ts

- **file:line** — `libs/registry/src/registry-types.ts:12-29, libs/registry/src/cli/registry.ts:10-24`
- **What** — The base RegistryItemSchema in registry-types.ts is duplicated and extended in cli/registry.ts. While the comment in registry-types.ts explains intentional separation, the intent is unclear: both validation schemas coexist without strong boundary enforcement (e.g., no clear separation between 'source' and 'installer' concerns).
- **Why** — Coexisting schemas without an enforced boundary blur which validation applies where, so source and installer concerns can leak across them as the schemas change.
- **How** — Document in a comment exactly what fields differ and why (e.g., 'installer requires stricter path validation'), or consider using Zod's discriminated unions to make the distinction explicit in the type system.
- **Effort** — medium

---

## Low

### F124 — [NEW] [dry] computeIntegrity function duplicated across artifact and CLI modules

- **file:line** — `libs/registry/src/cli/integrity.ts:5-7 and libs/registry/src/copy-bundle.ts:47-49`
- **What** — computeIntegrity (SHA-256 hash with 'sha256-' prefix) is identically implemented in both cli/integrity.ts and copy-bundle.ts with minor style difference (string concatenation vs template literal).
- **Why** — The same integrity-hash logic living in two places can drift, producing mismatched integrity strings between the artifact and CLI paths.
- **How** — If decoupling is truly required, document why in a shared constants or utils module and reexport from both locations. If decoupling can be relaxed, unify the implementation in a single location and import in both modules. Align code style to one approach (prefer template literals).
- **Effort** — low

### F129 — [NEW] [type-safety] Manifest field validation lacks exhaustiveness for registry.index and source paths

- **file:line** — `libs/registry/src/manifest.ts:23-25`
- **What** — ArtifactManifestRegistrySchema validates basePath and publicDir as strings with no path constraints, and registry.index (line 24) is validated as a string with only min-length 1. These should validate that paths do not escape the artifact root and follow the registry format.
- **Why** — Unconstrained path strings can encode paths that escape the artifact root, so the manifest schema does not enforce the boundary it implies.
- **How** — Apply the same RelativeArtifactPathSchema validation (which uses isRelativeSubpath) to registry.index and registry.publicDir, or add explicit regex/refine checks to ensure they are relative paths within bounds. Document the expected format.
- **Effort** — low

### F231 — [NEW] [anti-slop] Inconsistent string construction in duplicated computeIntegrity functions

- **file:line** — `libs/registry/src/copy-bundle.ts:47-49, libs/registry/src/cli/integrity.ts:5-7`
- **What** — The two intentionally-duplicated computeIntegrity() functions use different string construction patterns: template literal in copy-bundle.ts (`sha256-${...}`) vs. string concatenation in cli/integrity.ts (`"sha256-" + ...`).
- **Why** — Differing string-construction styles for the same logic signal accidental divergence and make the duplicated functions harder to recognize as equivalent.
- **How** — Normalize both to use template literals (modern ES6 standard) or add a comment explaining the intentional stylistic difference if there is a reason.
- **Effort** — low

### F234 — [NEW] [error-handling] Empty catch blocks in docs/sync-operations.ts with inline comments are justified but not idiomatic

- **file:line** — `libs/registry/src/docs/sync-operations.ts:26-46`
- **What** — assertNoUnrewrittenOrigin iterates over JSON files searching for a string pattern (sourceOrigin) using readFileSync + string.includes(). If readFileSync fails, the error is silently ignored. While the intent is clear (bail out if origin was not rewritten), the silent catch makes error debugging harder.
- **Why** — Swallowing every read failure means a real I/O error is indistinguishable from a missing file, hiding problems during debugging.
- **How** — Replace with try-catch that logs a warning for unexpected errors or re-throws them. Only silence errors if the intent is explicitly 'file does not exist' (use existsSync check first).
- **Effort** — low
