# Findings: types-exports

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 2 | 0 | 2 | 0 |
| High | 4 | 0 | 4 | 0 |
| Medium | 2 | 0 | 2 | 0 |
| Low | 6 | 0 | 6 | 0 |
| **Total** | **14** | **0** | **14** | **0** |

---

## Critical

### F316 — [NEW] [public-api] Public libs/keys source has relative .js import specifiers

- **file:line** — `libs/keys/src/index.ts:1-70`
- **What** — The main index.ts file in @diffgazer/keys (a public library) contains relative .js import specifiers (e.g., 'from "./providers/keyboard-provider.js"'). These hardcoded extensions violate the AGENTS.md rule and will break copy/shadcn consumers when registry source is copied locally.
- **Why** — Copy/shadcn consumers that paste this source locally cannot resolve the hardcoded .js specifiers, breaking the public installation path.
- **How** — Remove .js extensions from all relative imports in public library source files. Let TypeScript's declaration emitter add .js extensions to the generated .d.ts files automatically based on the module/moduleResolution settings. This requires changing lines like 'from "./providers/keyboard-provider.js"' to 'from "./providers/keyboard-provider"'.
- **Effort** — medium

### F317 — [NEW] [public-api] Public libs/ui source has relative .js import specifiers

- **file:line** — `libs/ui/registry/ui/diff-view/diff-view.tsx:22-23`
- **What** — Component source files in @diffgazer/ui (public library) use relative .js import specifiers throughout the registry. Examples: diff-view.tsx imports from "./diff-view-unified.js", diff-view-split.tsx imports from "./diff-view-line.js", etc. This affects dozens of components across the registry.
- **Why** — Hardcoded .js specifiers across many registry components break copy/shadcn consumers who paste the source locally.
- **How** — Remove .js extensions from all relative imports in libs/ui/registry source. Affected files: diff-view.tsx, diff-view-split.tsx, diff-view-unified.tsx, code-block/highlight.ts, command-palette/highlight.ts, logo/figlet.ts, block-bar components, and many others.
- **Effort** — medium

---

## High

### F70 — [NEW] [public-api] Missing `main` and `types` fields in @diffgazer/ui package.json

- **file:line** — `libs/ui/package.json:1-30`
- **What** — @diffgazer/ui does not define `main` or `types` top-level fields in package.json, only conditional `exports` mapping. This means consumers using legacy module resolution or tools that don't respect the exports field will not resolve the package correctly.
- **Why** — Tools and consumers that ignore the `exports` field have no entry point to resolve, so the package fails to load for them.
- **How** — Add `'main': './dist/index.js'` and `'types': './dist/index.d.ts'` fields to package.json, and consider adding a barrel re-export in dist/index.js that mirrors the main exports. Alternatively, document that the package is ESM-only with no default export and requires subpath imports (current design).
- **Effort** — low

### F195 — [NEW] [public-api] Public TS source files use relative .js imports (AGENTS.md violation)

- **file:line** — `libs/keys/src/index.ts:1-60`
- **What** — The public @diffgazer/keys library's TypeScript source exports use relative .js import specifiers throughout the codebase (e.g., 'from "./providers/keyboard-provider.js"' on line 3), and this pattern is repeated across 18+ source files in the keys package. This violates the AGENTS.md rule: 'Public libs/keys public/r TS must not emit relative .js import specifiers'.
- **Why** — Relative .js specifiers spread across 18+ source files break copy/shadcn consumers and contradict the documented public registry contract.
- **How** — Systematically remove .js extensions from all import statements in /libs/keys/src/**/*.ts and /libs/keys/src/**/*.tsx (excluding test files). This applies to all relative imports like './providers/keyboard-provider.js' → './providers/keyboard-provider'. The declaration build process (build-declarations.ts) handles adding .js to declarations automatically.
- **Effort** — medium

### F196 — [NEW] [public-api] Core library also has relative .js imports in public-facing source

- **file:line** — `libs/core/src/index.ts:1-100`
- **What** — @diffgazer/core (a private but exported library with 20+ public entry points) has the same pattern: all source TS files use relative .js imports. This affects all index.ts files, hook exports, schema exports, form exports, etc.
- **Why** — The .js specifiers propagate through 20+ public entry points consumed by the CLI packages, breaking source-copy resolution downstream.
- **How** — Remove .js extensions from all relative imports in /libs/core/src/**/*.ts, including files like index.ts, hooks/index.ts, forms/index.ts, providers/index.ts, schemas/index.ts, api/index.ts, and api/hooks/index.ts.
- **Effort** — medium

### F318 — [NEW] [public-api] Public libs/core source has relative .js import specifiers

- **file:line** — `libs/core/src/index.ts:1-6`
- **What** — @diffgazer/core (private package used by public CLI packages) has relative .js import specifiers in its main entry point: 'export * from "./layout/breakpoints.js"' etc. While @diffgazer/core is marked private in package.json, it is consumed by public packages @diffgazer/add and diffgazer, making this a transitive public API issue.
- **Why** — Because public CLI packages depend on core, its .js specifiers leak into the public surface and break transitive source-copy consumers.
- **How** — Remove .js extensions from relative imports in libs/core/src/index.ts and throughout the source. Lines like 'export * from "./result.js"' should become 'export * from "./result"'.
- **Effort** — low

---

## Medium

### F197 — [NEW] [public-api] UI library registry code also has .js imports in production source

- **file:line** — `libs/ui/registry/lib/diff/index.ts:1-50`
- **What** — The @diffgazer/ui registry source (which is bundled and exported) uses .js import specifiers in index files and utility exports. Examples: 'from "./parse.js"' in libs/ui/registry/lib/diff/index.ts and 'from "./get-figlet-text.js"' in libs/ui/registry/ui/logo/figlet.ts.
- **Why** — Bundled-and-exported registry index files carrying .js specifiers undermine clean source-copy consumption of the public registry.
- **How** — Remove .js extensions from relative imports in libs/ui/registry/lib/diff/index.ts, libs/ui/registry/ui/logo/figlet.ts, and other registry index files. The bundler handles proper output generation.
- **Effort** — low

### F319 — [NEW] [type-safety] Inconsistent moduleResolution between @diffgazer/core and @diffgazer/keys/@diffgazer/ui

- **file:line** — `libs/core/tsconfig/base.json:8-9, libs/keys/tsconfig.json:11-12`
- **What** — @diffgazer/core uses moduleResolution: "NodeNext" with module: "NodeNext", while @diffgazer/keys and @diffgazer/ui use moduleResolution: "Bundler" with module: "ESNext". This creates inconsistent module handling across the monorepo's public libraries.
- **Why** — Divergent module-resolution settings cause libraries to interpret imports differently, producing inconsistent emit and resolution behavior across the monorepo.
- **How** — Choose a single moduleResolution strategy for all libraries and apply consistently. For a browser-heavy monorepo with React, "Bundler" + "ESNext" is more appropriate. Update libs/core/tsconfig/base.json to match: moduleResolution: "Bundler", module: "ESNext". Verify declaration emit remains correct after the change.
- **Effort** — low

---

## Low

### F67 — [NEW] [type-safety] Polymorphic ref casting with `as never` — working but undocumented pattern

- **file:line** — `libs/ui/registry/ui/card/card.tsx:77`
- **What** — Card and Typography components use `ref={ref as never}` to cast polymorphic refs. While documented in inline comments, this is a TypeScript limitation workaround for polymorphic generics that bypasses the type system.
- **Why** — An undocumented type-system bypass can mask real ref type mismatches and confuse future maintainers about whether the cast is intentional.
- **How** — Document this pattern in the ui library's PATTERNS.md or a type-safety guide. Consider adding a helper function `castPolymorphicRef<T>(ref: Ref<T>): never` with explicit documentation, or use a type-safe alternative such as a callback-based approach if ref forwarding can be avoided.
- **Effort** — low

### F68 — [NEW] [type-safety] Test-only unsafe casts not marked with clear test context

- **file:line** — `libs/core/src/api/openrouter-utils.test.ts:varies`
- **What** — Several test files use `as unknown as T` to inject deliberately malformed data for negative/boundary tests (e.g., `undefined as unknown as string`). These are intentional test fixtures but could be confused with real type errors during code review.
- **Why** — Unlabeled intentional casts are indistinguishable from accidental type errors during review, slowing audits and risking incorrect "fixes".
- **How** — Add a test-only utility function `testCast<T>(value: any, reason: string): T` or prefix these with clear comments: `// Test: deliberately bypass types to verify error handling` to document intent.
- **Effort** — low

### F69 — [NEW] [type-safety] Registry tsconfig has `verbatimModuleSyntax: false` while all other packages use `true`

- **file:line** — `libs/ui/registry/tsconfig.json:10`
- **What** — The registry tsconfig (used for dev-time source checking of registry items) disables `verbatimModuleSyntax: false`, while the main package and all other libs require `true`. This creates an inconsistency in how types are preserved during compilation.
- **Why** — A single config diverging on `verbatimModuleSyntax` lets registry source compile under rules the rest of the monorepo rejects, masking import/type issues.
- **How** — Either: (1) Enable `verbatimModuleSyntax: true` in registry/tsconfig.json if build output exists, or (2) Add a comment explaining why registry requires false (e.g., 'Registry sources are dev-time only and do not emit; false allows flexible path references during source analysis'). Verify with the build script that no artifacts depend on this setting.
- **Effort** — low

### F71 — [NEW] [docs] Optional peerDependencies not documented in public API surface

- **file:line** — `libs/ui/package.json:331-348`
- **What** — @diffgazer/ui declares @diffgazer/keys, figlet, and lowlight as optional peerDependencies, but the public API surface and export map do not make clear which exports require which optional peers.
- **Why** — Consumers cannot tell which optional peers an export needs, leading to runtime failures when a required peer is missing.
- **How** — Add a section to the ui package README documenting optional dependencies: 'Optional Peers: @diffgazer/keys required for keyboard navigation components, figlet for Logo component, lowlight for syntax highlighting in CodeBlock.' Update component-level JSDoc to note optional peer requirements.
- **Effort** — low

### F198 — [NEW] [type-safety] Overly permissive options object type in CLI init command

- **file:line** — `cli/add/src/commands/init.ts:33`
- **What** — The buildInitPlannedPaths function accepts opts: { componentsDir?: unknown; [key: string]: unknown }, allowing any unknown keys without validation. This bypasses type safety for configuration options.
- **Why** — An index signature of `unknown` accepts any shape, so invalid options pass type checking and surface only as runtime failures.
- **How** — Define a specific Options interface with known properties (e.g., interface InitOptions { componentsDir?: string; ... }) instead of [key: string]: unknown. Validate opts at the entry point using a schema library (Zod already used in the project).
- **Effort** — low

### F320 — [NEW] [type-safety] CLI add/diffgazer also have relative .js specifiers (private packages, lower priority)

- **file:line** — `cli/add/src/context.ts:1, cli/diffgazer/src/tui-entry.tsx:1-10`
- **What** — Public CLI packages @diffgazer/add and diffgazer also use relative .js import specifiers in their source. Examples: cli/add/src/context.ts 'from "./utils/paths.js"', cli/diffgazer/src/tui-entry.tsx 'from "./lib/shutdown-token.js"'.
- **Why** — The same .js specifier pattern in CLI source keeps module-resolution conventions inconsistent with the libs fix, though impact is lower for these consumed-as-binary packages.
- **How** — Remove .js extensions from relative imports in cli/add/src and cli/diffgazer/src. However, prioritize the libs fixes first as they are used as published packages.
- **Effort** — medium
