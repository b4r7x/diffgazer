# Findings: `@diffgazer/docs` (apps/docs)

Date: 2026-05-28

## Summary

| Severity | Count | Status |
| --- | --- | --- |
| Critical | 1 | 1 NEW |
| High | 0 | — |
| Medium | 10 | 10 NEW |
| Low | 8 | 8 NEW |
| **Total** | **19** | **19 NEW** |

---

## Critical

### F164 — [NEW] [type-safety] Invalid React Context Provider syntax in SearchContext

- **File:** `apps/docs/src/features/search/search-context.tsx:13`
- **What:** SearchProvider component renders `<SearchContext value={value}>` instead of `<SearchContext.Provider value={value}>`.
- **Why:** Critical — invalid Context Provider syntax breaks the provider contract; consumers do not receive the intended context value.
- **How:** Change line 13 from `<SearchContext value={value}>{children}</SearchContext>` to `<SearchContext.Provider value={value}>{children}</SearchContext.Provider>`.
- **Effort:** low

---

## Medium

### F37 — [NEW] [type-safety] Type assertion bypass in server loader (fumadocs boundary)

- **File:** `apps/docs/src/routes/$lib.tsx:20`
- **What:** Type casting uses `as unknown as PageTree` to bridge fumadocs-core PageTree type to local PageTree definition, suppressing type checking.
- **Why:** Suppressing type checking at the fumadocs boundary hides real shape mismatches and defeats compile-time safety.
- **How:** Extract a proper type converter function that validates the structure instead of double-casting. Define a Zod schema or type guard that validates fumadocs PageTree shape at runtime, then narrow the type correctly.
- **Effort:** medium

### F38 — [NEW] [type-safety] Cross-library type cast in source viewer (generated data mismatch)

- **File:** `apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx:32`
- **What:** Casting `resolveCrossDepFiles()` result to broader type without validation: `as typeof sourceFiles` ignores type narrowing.
- **Why:** An unchecked cast across the generated-data boundary can mask shape drift between `CrossDepSourceFile[]` and `SourceFile[]`.
- **How:** Create a type-safe mapper function that transforms `CrossDepSourceFile[]` to `SourceFile[]`, validating the `highlighted` field shape. Remove the `as` cast and use explicit mapping.
- **Effort:** low

### F165 — [NEW] [performance] Unnecessary useMemo with unstable deps in SearchProvider

- **File:** `apps/docs/src/features/search/search-context.tsx:12`
- **What:** useMemo memoizes a simple object using `[open, setOpen]` as deps, but setOpen is a state setter which is stable across renders.
- **Why:** Memoizing a trivial object adds complexity without benefit and signals a misunderstanding of setter stability.
- **How:** Either remove the useMemo entirely since the object is trivial to create, or if kept, use only `[open]` as deps since setOpen is stable. Simplest fix: `const value = { open, setOpen }`.
- **Effort:** low

### F166 — [NEW] [type-safety] Type assertion bypass in docs shell loader with explanation comment

- **File:** `apps/docs/src/routes/$lib.tsx:20`
- **What:** Code uses `source.pageTree as unknown as PageTree` to bypass type checking between fumadocs-core's PageTree and local definition.
- **Why:** A double-cast through `unknown` silently bridges two PageTree definitions, hiding incompatibilities that should be made explicit.
- **How:** Either (1) import PageTree directly from fumadocs-core and remove the local definition, or (2) create a type guard function `isFumadocsPageTree()` and use it instead of assertions, or (3) add a JSDoc explaining the intentional boundary type mismatch.
- **Effort:** medium

### F167 — [NEW] [type-safety] CrossDepSourceFile type cast in source viewer lacks type safety

- **File:** `apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx:32`
- **What:** Code casts `resolveCrossDepFiles` result with `as typeof sourceFiles` to bridge type mismatch between `CrossDepSourceFile.highlighted` and `CodeBlockLineProps[]`.
- **Why:** The cast bridges incompatible `highlighted` types without a runtime guarantee, risking malformed code-block line data.
- **How:** Either (1) widen `CrossDepSourceFile.highlighted` to match `CodeBlockLineProps[]`, or (2) add explicit mapping `sourceFiles.push(...resolveCrossDepFiles(data.crossDeps).map(f => ({ ...f, highlighted: f.highlighted as CodeBlockLineProps[] })))` to make the conversion explicit.
- **Effort:** medium

### F278 — [NEW] [reusability] SearchProvider: Unnecessary useMemo with stable callback in dependency array

- **File:** `apps/docs/src/features/search/search-context.tsx:12`
- **What:** useMemo memoizes the context value object, but includes setOpen (a stable callback) in the dependency array, causing unnecessary re-renders and object allocations every time open state changes.
- **Why:** Memoization that re-runs on every `open` change provides no value and only benefits descendants wrapped in `memo()`.
- **How:** Remove useMemo entirely; create the value object inline. Only descendants wrapped in `memo()` benefit from memoization. Simplify to: `return <SearchContext.Provider value={{ open, setOpen }}>{children}</SearchContext.Provider>`.
- **Effort:** low

### F279 — [NEW] [security] seo.ts: Mixing process.env and import.meta.env for same variable

- **File:** `apps/docs/src/lib/seo.ts:9-14`
- **What:** PUBLIC_ORIGIN reads `process.env.VITE_PUBLIC_ORIGIN` first (server-only), then falls back to `import.meta.env.VITE_PUBLIC_ORIGIN` (client/build-time). This pattern is unclear: code is shared between server and client but env access semantics differ.
- **Why:** Divergent env-access semantics in shared code make the value source ambiguous and can leak or misresolve origins across server/client boundaries.
- **How:** Clarify intent: if server-only (route head), use only `process.env` with a comment. If client is also a consumer, use only `import.meta.env` and set env vars in `.env` files. If build-time override is needed, document why the `process.env` fallback exists. Add a comment explaining the two-stage fallback logic.
- **Effort:** low

### F280 — [NEW] [type-safety] Type casting with unknown intermediate in route pageTree assignment

- **File:** `apps/docs/src/routes/$lib.tsx:20`
- **What:** The pageTree from fumadocs-core is cast to `unknown`, then to local PageTree type, bypassing type checking. This suggests a mismatch between fumadocs-core's PageTree and the local definition.
- **Why:** Silent casts through `unknown` defeat type checking and obscure a real type incompatibility that should be resolved or documented.
- **How:** Investigate why fumadocs-core PageTree doesn't match the local definition. Option 1: import and use fumadocs-core's PageTree directly if compatible. Option 2: define a clear type adapter that explains the difference. Option 3: add a comment documenting the known incompatibility and why the cast is safe. Avoid silent casts to `unknown`.
- **Effort:** medium

### F282 — [NEW] [type-safety] Cross-library type annotation mismatch in source-viewer-block.tsx

- **File:** `apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx:31-32`
- **What:** `CrossDepSourceFile.highlighted` is cast as `CodeBlockLineProps[]` with a comment acknowledging the type bridge. This suggests the generated data shape does not align with the component's expected type.
- **Why:** A documented-but-unverified type bridge between generated data and the component contract can drift silently when either side changes.
- **How:** Define a proper type adapter or widen the `CrossDepSourceFile` type to match `CodeBlockLineProps[]`. Add a unit test verifying the data shape at the boundary. If the mismatch is intentional, document why (e.g., "generated data omits line content but CodeBlockLine only uses number field, so cast is safe").
- **Effort:** medium

### F283 — [NEW] [architecture] Hardcoded default registry origin URL with no env fallback consistency

- **File:** `apps/docs/src/lib/consumption-metadata.ts:7`
- **What:** REGISTRY_ORIGIN falls back to a hardcoded URL `https://r.b4r7.dev` when `VITE_REGISTRY_ORIGIN` is not set. This assumes a fixed registry domain for both dev and production environments.
- **Why:** A hardcoded origin couples docs to one registry domain and diverges from other env-resolution patterns, complicating environment-specific deploys.
- **How:** Add `VITE_REGISTRY_ORIGIN` to the env configuration (`.env`, `.env.local`, deploy config). Define a `DEFAULT_REGISTRY_ORIGIN` constant and document which environments use which URL. Align with the `seo.ts` pattern if both are customer-facing.
- **Effort:** low

---

## Low

### F39 — [NEW] [dead-code] Console.error statement in production code path

- **File:** `apps/docs/src/components/copy-button.tsx:43`
- **What:** Production-level `console.error()` logs clipboard write failures; no guard for production vs dev environment.
- **Why:** Unguarded console logging leaks noise into production consoles and is inconsistent with the guarded pattern used elsewhere.
- **How:** Wrap `console.error` with `if (import.meta.env.DEV)` guard, or replace with a structured error handler/logger. Keep the `toast.error()` call.
- **Effort:** low

### F40 — [NEW] [dead-code] Inconsistent error console logging pattern

- **File:** `apps/docs/src/lib/use-demos.ts:26`
- **What:** Two console logging patterns: `use-demos.ts` guards with `if (import.meta.env.DEV)`, but `copy-button.tsx` does not. Both are errors that should be logged consistently.
- **Why:** Inconsistent logging conventions across files make error reporting unpredictable and harder to maintain.
- **How:** Apply the DEV guard consistently: wrap all `console.warn`/`console.error` calls. Create a shared logger module if many files need consistent error reporting.
- **Effort:** low

### F41 — [NEW] [reusability] Unused inline type alias (semantic re-export antipattern)

- **File:** `apps/docs/src/lib/docs-library.ts:9-11`
- **What:** Three unnecessary type re-exports: `RawLibraryId` (line 8) is derived from config JSON, `ArtifactSourceConfig` and `DocsLibraryConfigData` are imported and re-exported without modification.
- **Why:** Pass-through re-exports add indirection without adding meaning, contrary to the repo's no-alias guidance.
- **How:** Remove lines 10-11. Import directly: `export type { DocsLibraryConfigData } from './docs-libraries-config'`. Keep `DocsLibraryId` as the primary export.
- **Effort:** low

### F42 — [NEW] [dry] Magic string duplicated across libraries and UI (section index set)

- **File:** `apps/docs/src/components/breadcrumbs.tsx:12-19`
- **What:** Hardcoded `SECTIONS_WITH_INDEX` set contains paths like `'ui'`, `'ui/cli'`, `'keys'` that must match actual `index.mdx` files in `content/docs/`. Maintainer must manually keep it in sync.
- **Why:** A manually maintained set that mirrors the file system drifts out of sync as docs are added or moved.
- **How:** Generate this set from the actual file system or fumadocs `source.pageTree` structure at build time. Add a comment linking to the build-time source, or validate against source in a test.
- **Effort:** medium

### F168 — [NEW] [docs] Environment variable VITE_REGISTRY_ORIGIN not documented in .env.example

- **File:** `apps/docs/src/lib/consumption-metadata.ts:7`
- **What:** Code reads `import.meta.env.VITE_REGISTRY_ORIGIN` with default `https://r.b4r7.dev` but no `.env.example` exists to document this variable.
- **Why:** Undocumented env vars hide configuration surface from contributors and deployers, increasing setup friction.
- **How:** Create `apps/docs/.env.example` with entries: `VITE_REGISTRY_ORIGIN=https://r.b4r7.dev` and `VITE_PUBLIC_ORIGIN=https://docs.b4r7.dev`, with comments explaining their purpose.
- **Effort:** low

### F171 — [NEW] [performance] Sidebar section keys depend on index and title - could cause reconciliation issues

- **File:** `apps/docs/src/layouts/sidebar.tsx:96`
- **What:** SidebarSection uses `key={`${i}-${section.title}`}` where `i` is the array index.
- **Why:** Index-based keys can cause incorrect reconciliation and state mismatches if the section list reorders.
- **How:** Use a stable identifier like `section.title` alone (if unique) or a content-hash if titles are user-generated. For static sections, consider removing the key or using `section.title`: `key={section.title}`.
- **Effort:** low

### F172 — [NEW] [other] Sidebar link onNavigate fires on all clicks including middle-click and Ctrl+Click

- **File:** `apps/docs/src/layouts/sidebar.tsx:117-123`
- **What:** SidebarItem Link `onClick={onNavigate}` will fire the `onNavigate` callback even on middle-click (open in new tab) or Ctrl+Click, which closes the sidebar unexpectedly.
- **Why:** Closing the sidebar on modified/middle clicks breaks the expected open-in-new-tab UX.
- **How:** Add a guard in the `onNavigate` handler to only close the sidebar on primary click (`button === 0`, no modifiers). Or move the `onClick` logic into the Link component to check `event.button`/key modifiers before calling `onNavigate`.
- **Effort:** low

### F281 — [NEW] [other] Experimental React hook useEffectEvent without documentation

- **File:** `apps/docs/src/features/theme/components/variable-diagram.tsx:1, 36`
- **What:** `useEffectEvent` is imported and used, but it is an experimental React hook not part of the public API as of the knowledge cutoff.
- **Why:** Relying on an unstable, undocumented hook risks breakage on React upgrades and confuses future maintainers.
- **How:** Add a comment explaining why `useEffectEvent` is necessary (e.g., "Event handler that re-computes line positions without adding dependency-chain complexity"). Alternatively, move `computeLines` inside the `useEffect` where it's called, or use `useCallback` if the hook becomes unavailable.
- **Effort:** low
