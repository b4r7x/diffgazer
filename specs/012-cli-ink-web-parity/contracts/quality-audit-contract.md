# Contract: Quality Audit Criteria

## Audit Scope

The audit covers the **entire codebase**: `apps/cli/`, `apps/web/`, `packages/api/`, `packages/core/`, `packages/schemas/`, `packages/hooks/`.

## Quality Gates (zero tolerance)

### DRY
- **No duplicate types**: Any type/interface used by both apps MUST live in a shared package
- **No duplicate constants**: Any constant used by both apps MUST live in a shared package
- **No duplicate utility functions**: Any function used by both apps MUST live in a shared package
- **No duplicate data-fetching logic**: All API interactions MUST flow through `@diffgazer/api/hooks`

### KISS
- **No over-complex hooks**: Any hook with >150 lines or >10 return values should be decomposed
- **No multi-concern components**: Components should not mix data fetching, keyboard handling, and rendering in a single function

### YAGNI
- **No unused exports**: Public API surface of shared packages should not include dead exports
- **No premature feature flags**: Constants that are always the same value should be inlined
- **No speculative abstractions**: Don't create helpers for one-time operations

### SRP
- **One responsibility per hook**: Data hooks fetch data, keyboard hooks handle input, lifecycle hooks manage phase transitions
- **One responsibility per component**: Components render UI — they can consume hooks but should not contain business logic

### No Thin Wrappers
- **No pass-through components**: Components that only forward props to a child without adding behavior should be eliminated
- **Exception**: Route files in TanStack Router file-based routing (these are a framework convention)

## Measurement

Each finding is categorized as:
- **Severity: High** — Affects >3 files or creates maintenance burden across apps
- **Severity: Medium** — Affects 2-3 files or a single complex module
- **Severity: Low** — Single-file cleanup, unused export removal

All High and Medium findings MUST be resolved. Low findings SHOULD be resolved.
