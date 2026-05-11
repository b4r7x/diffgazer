# Agent 01: Keys Scope And Provider Runtime

Model: Opus 4.7
Mode: implementation

## Required Skills

Load before work:

- `$sota`
- `$code-audit`
- `architecture`
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `typescript-expert`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`

## Write Ownership

Primary:

- `libs/keys/src/hooks/use-key.ts`
- `libs/keys/src/hooks/use-scope.ts`
- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/context/keyboard-context.ts`
- `libs/keys/src/hooks/use-key.test.tsx`
- `libs/keys/src/hooks/use-scope.test.tsx`
- `libs/keys/src/providers/keyboard-provider.test.tsx`
- `libs/keys/src/index.ts`

Coordinate before touching:

- `libs/keys/docs/**`
- `libs/keys/registry/**`
- `apps/web/src/**`

## Issues

- `../issues/KYS-001-scope-registration.md`

## Requirements

- Fix implicit scope registration so colocated and same-commit scope/key usage is deterministic.
- Preserve explicit `scope` option behavior.
- Do not introduce render-phase ref reads/writes for render-affecting behavior.
- Export missing public types if needed, including `UseScopeOptions` and `KeyboardContextValue`, through the package root.
- Keep provider cleanup StrictMode-safe.

## Tests

Use TDD. Add failing tests first for:

- disabled `useScope` becoming enabled with colocated implicit `useKey`;
- enabled `useScope` becoming disabled without leaving stale hidden handlers;
- parent/global `useKey` mounted in same commit as child scope remains global unless explicitly scoped;
- explicitly scoped `useKey` still works;
- StrictMode cleanup remains correct.

## Verification

Run:

```bash
pnpm --filter @diffgazer/keys test -- use-key use-scope keyboard-provider
pnpm --filter @diffgazer/keys type-check
```

Report exact output and any remaining risks.
