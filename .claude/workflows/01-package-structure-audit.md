# Package Structure Audit Workflow

## Overview

Analyze and improve file structure in `packages/` (core, schemas, api) based on OSS best practices.

---

## Phase 1: Research (Parallel Agents)

### Agent 1: OSS Structure Research
```
Web search for file structure patterns in:
- zustand (state management)
- @vercel/ai (AI SDK)
- trpc (type-safe APIs)
- zod (schema validation)

Focus on:
- How they organize exports (barrel files vs direct imports)
- Test file placement
- Type definitions location
- Internal vs public API separation
```

### Agent 2: Current Structure Analysis
```
Analyze packages/:
- packages/core/src/
- packages/schemas/src/
- packages/api/src/

Document:
- Current file organization
- Export patterns
- Dependencies between packages
- Test coverage and placement
```

---

## Phase 2: Compare & Plan (Sequential)

### Agent 3: Gap Analysis
```
Compare current structure with OSS best practices:

1. Identify misalignments
2. Check if current patterns have valid reasons (see .claude/docs/patterns.md)
3. Propose changes that:
   - Don't break existing imports
   - Follow monorepo conventions
   - Respect package boundaries (schemas is leaf, api is leaf)
```

---

## Phase 3: Refactor (Parallel Agents)

### Agent 4: Core Package Refactor
```
Target: packages/core/src/

Apply findings:
- Consolidate related utilities
- Improve barrel exports
- Move tests if needed (keep grouped with source)
- Remove dead code
```

### Agent 5: Schemas Package Refactor
```
Target: packages/schemas/src/

Apply findings:
- Consistent schema file naming
- Proper type exports
- Test organization
```

### Agent 6: API Package Refactor
```
Target: packages/api/src/

Apply findings:
- Clean client structure
- Type exports
```

---

## Phase 4: Validation

### Agent 7: Code Simplifier
```
Run code-simplifier on all packages:
- Remove unnecessary abstractions
- Consolidate duplicates
- Verify no dead code remains
```

---

## Expected Output

1. **Structure Report**: Current vs recommended structure
2. **Migration Plan**: Step-by-step changes
3. **Refactored Code**: Applied changes
4. **Validation**: Type-check passes, tests pass

---

## Constraints

- Must not break existing imports from apps/
- Must respect import boundaries (see docs/architecture.md Section D)
- schemas and api are leaf packages (no monorepo imports)
