# TASK-014: Setup Vitest Infrastructure

## Metadata

- **Priority**: P2 (Enhancement - enables test coverage)
- **Agent**: `test-automator`
- **Dependencies**: None (can be done anytime)
- **Package**: Root and all packages

## Context

The project currently has zero test coverage. This task sets up the test infrastructure using Vitest.

## Current State

No test configuration exists:
- No vitest.config.ts
- No test scripts in package.json
- No __tests__ directories
- No test files

## Target State

### Root `package.json`

Add test scripts:

```json
{
  "scripts": {
    "test": "turbo test",
    "test:watch": "turbo test:watch"
  }
}
```

### Root `vitest.workspace.ts`

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);
```

### `packages/schemas/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

### `packages/schemas/package.json`

Add test scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### `packages/core/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

### `packages/core/package.json`

Add test scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Install Dependencies

```bash
pnpm add -D -w vitest
pnpm add -D -w @vitest/coverage-v8  # Optional: for coverage
```

### `turbo.json`

Add test pipeline:

```json
{
  "pipeline": {
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Files to Create/Modify

1. **Create** `vitest.workspace.ts` (root)
   - Workspace configuration

2. **Create** `packages/schemas/vitest.config.ts`
   - Schema package test config

3. **Create** `packages/core/vitest.config.ts`
   - Core package test config

4. **Update** Root `package.json`
   - Add test scripts

5. **Update** `packages/schemas/package.json`
   - Add test scripts

6. **Update** `packages/core/package.json`
   - Add test scripts

7. **Update** `turbo.json`
   - Add test pipeline

8. **Install** vitest as dev dependency

## Acceptance Criteria

- [ ] Vitest installed as dev dependency
- [ ] `vitest.workspace.ts` configures workspace
- [ ] Each package has `vitest.config.ts`
- [ ] Each package has test scripts
- [ ] `pnpm test` runs all tests (currently none)
- [ ] `pnpm test:watch` starts watch mode
- [ ] Turbo pipeline includes test tasks
- [ ] `pnpm build` still passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm install
pnpm test  # Should run (with 0 tests)
pnpm build
```

## Notes

- Start with minimal config - add coverage later.
- Use `environment: "node"` for all packages (no DOM needed).
- Tests will be added in TASK-015 and TASK-016.
- The workspace config allows running all tests from root.
