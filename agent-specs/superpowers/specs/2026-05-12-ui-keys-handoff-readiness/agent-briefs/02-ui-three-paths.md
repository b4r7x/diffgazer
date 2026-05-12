# 02 — UI Three-Path Readiness

> Implement only this brief. Do not run git add/commit/stage/stash.

## Goal

Make public `libs/ui` components, hooks, and true utilities work across manual/direct shadcn, `dgadd`, and npm package mode.

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
- `libs/ui/README.md`
- `libs/ui/package.json`
- `libs/ui/registry/registry.json`
- `libs/ui/public/r/registry.json`
- `libs/ui/scripts/build-shadcn-registry.ts`
- `libs/ui/scripts/transform-public-registry-keys-imports.ts`
- `libs/ui/tsup.config.ts`
- `cli/add/src/utils/registry.ts`
- `cli/add/src/utils/transform.ts`
- `libs/ui/docs/content/utils/shadcn-namespace.mdx`

## Write Ownership

```text
libs/ui/registry/registry.json
libs/ui/public/r/*.json
libs/ui/scripts/**
libs/ui/registry/ui/**
libs/ui/registry/hooks/**
libs/ui/registry/lib/**
libs/ui/registry/**/*.test.ts
libs/ui/registry/**/*.test.tsx
libs/ui/package.json
libs/ui/README.md
libs/ui/docs/content/**
cli/add/src/utils/registry.ts
cli/add/src/utils/transform.ts
```

## Required Behavior

### Part A: Public registry copy content must not leak package-only ESM specifiers

Direct copy/public registry content must not contain relative `.js` imports for TypeScript source consumers.

Known affected areas from audit:

- `block-bar`
- `diff-view`
- `diff`

Use the same transform semantics as `dgadd` or move the transform to shared registry tooling.

### Part B: Keys imports must be copy-safe

Public UI copy mode must rewrite `@diffgazer/keys` imports into local copied hook/utility paths or declare `@diffgazer-keys/*` registry dependencies that resolve through direct shadcn.

Unknown keys imports must fail validation rather than silently preserving a package dependency in copy mode.

### Part C: CSS-heavy components must have a complete direct shadcn path

Components such as `Dialog`, `CommandPalette`, `Select`, `Popover`, and `Tooltip` depend on component CSS. Direct shadcn/manual copy must either:

1. install/materialize the same aggregated `styles.css` that package and `dgadd` consumers get, or
2. have explicit direct-shadcn docs and smoke tests proving the required CSS files are installed/importable.

Prefer making direct shadcn complete instead of documenting a partial path.

### Part D: Public surface must be intentional

Review public `registry:lib` and package exports:

- `diff`
- `focus`
- `input-variants`
- `resolve-tab-target`
- `search`
- `selectable-variants`
- `selectable-collection`
- `step-status`
- `compose-refs`

For each, choose one:

- keep public and document/test all three paths,
- hide/internalize,
- move to `libs/keys` if it is keyboard/focus-owned.

`focus` is currently a likely boundary violation because generic focus utilities belong in `libs/keys`.

### Part E: Remove stale dependency metadata

Audit registry dependency metadata. Known candidate:

- `ui/overflow` declares `class-variance-authority` but appears not to import it.

Remove unused install metadata if confirmed.

## Tests

Add or update tests for:

- no `.js` import leaks in `libs/ui/public/r/*.json`,
- unknown `@diffgazer/keys` copy imports fail validation,
- direct shadcn install/build for representative UI items,
- CSS presence for CSS-heavy components,
- `Badge` and `Kbd` public smoke tests,
- `useTypeaheadBuffer` behavior,
- UI-to-keys integration for `RadioGroup`, `ToggleGroup`, `NavigationList`, `Menu`, `Select`, `Tabs`, `CommandPalette`.

## Verification

```bash
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/registry test
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
git diff --check
```

