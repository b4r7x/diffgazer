# 01 — Keys Three-Path Readiness

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Make public `libs/keys` standalone items work across manual/direct shadcn, `dgadd`, and npm package mode.

## Required Skills

- `/code-audit`
- `/clean-code`
- `/code-quality`
- `/anti-slop`
- `/sota`
- `/react-senior-guide`
- `/test-behavior-not-implementation`

## Required Reading

- `AGENTS.md`
- `libs/keys/README.md`
- `libs/keys/registry/registry.json`
- `libs/keys/public/r/registry.json`
- `libs/keys/scripts/transform-public-registry-imports.ts`
- `libs/keys/scripts/validate-registry-closure.ts`
- `cli/add/scripts/generate-keys-copy-bundle.ts`
- `cli/add/src/utils/namespaces.ts`
- `cli/add/src/utils/transform.ts`
- `libs/keys/src/index.ts`
- `libs/keys/src/hooks/use-navigation.ts`
- `libs/keys/src/hooks/use-focus-restore.ts`
- `libs/keys/src/hooks/use-focus-trap.ts`
- `libs/keys/src/hooks/use-scroll-lock.ts`

## Write Ownership

```text
libs/keys/registry/registry.json
libs/keys/public/r/*.json
libs/keys/scripts/transform-public-registry-imports.ts
libs/keys/scripts/validate-registry-closure.ts
libs/keys/src/hooks/*.ts
libs/keys/src/utils/*.ts
libs/keys/src/**/*.test.ts
libs/keys/src/**/*.test.tsx
libs/keys/README.md
libs/keys/docs/content/**
cli/add/scripts/generate-keys-copy-bundle.ts
cli/add/src/utils/transform.ts
cli/add/src/utils/integration.ts
```

## Required Behavior

### Part A: Direct shadcn/manual copy targets

Public standalone keys registry items must install to paths that preserve their imports after shadcn target resolution.

Required public items:

- `keys/navigation`
- `keys/focus-restore`
- `keys/focus-trap`
- `keys/scroll-lock`

Hidden/transitive item:

- `keys/focusable`

Provider-backed package-only APIs:

- `KeyboardProvider`
- `useKey`
- `useScope`
- `useScopedNavigation`
- `useFocusZone`
- `keys`
- context hooks

Expected target shape:

```text
@hooks/use-navigation.ts
@hooks/utils/navigation-items.ts
@hooks/utils/navigation-dispatch.ts
@hooks/utils/keyboard-utils.ts
@hooks/use-focus-restore.ts
@hooks/utils/focus-restore.ts
@hooks/use-focus-trap.ts
@hooks/utils/focusable.ts
@hooks/use-scroll-lock.ts
```

Adjust exact filenames only if the registry/import transform keeps the installed source buildable.

### Part B: Source-aware import transform

Public keys registry output must rewrite imports to match the installed target layout and remove relative `.js` specifiers for copy consumers.

Examples:

```typescript
// source can use ESM .js:
import { getEnabledNavigationItems } from "../utils/navigation-items.js";

// public copied hook should resolve from installed hook path:
import { getEnabledNavigationItems } from "./utils/navigation-items";
```

Side-effect relative imports must be handled too if they appear later:

```typescript
import "./style.js";
```

### Part C: Validation must check install closure, not only source closure

Add a validation path that simulates public registry target resolution or runs an equivalent fixture check. The current source closure check is not enough because source paths can pass while installed paths fail.

### Part D: Package mode remains root-only

Keep npm package import contract as root-only unless this spec explicitly adds subpath exports:

```typescript
import { KeyboardProvider, useKey, useNavigation } from "@diffgazer/keys";
```

Docs must state which APIs are package-only.

## Tests

Add or update behavior-focused tests for:

- public registry target paths for keys files,
- import rewriting after target resolution,
- no relative `.js` imports in public copy content,
- hidden `focusable` as transitive dependency,
- provider-backed hooks marked package-only in docs/metadata.

Add a direct shadcn/manual copy smoke or equivalent fixture for:

```bash
shadcn add @diffgazer-keys/navigation
shadcn add @diffgazer-keys/focus-trap
```

Then type-check/build the fixture.

## Verification

```bash
pnpm --filter @diffgazer/keys validate:registry
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/add test -- src/commands/cli-behavior.test.ts
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
git diff --check
```

