# KYS-001: Scope Registration And Provider Ordering

Priority: P0

## Problem

`useKey` can register a shortcut in the wrong scope when it relies on implicit `getActiveScope()`.

Known cases:

- `useScope("modal", { enabled: false })` later becomes enabled, but colocated `useKey("Escape", handler)` may remain registered in `"global"`.
- Parent or sibling `useKey` mounted in the same commit as a child `useScope` can register into the child scope because `useScope` pushes in a layout effect before `useKey`'s passive effect.

Evidence:

- `libs/keys/src/hooks/use-key.ts`
- `libs/keys/src/hooks/use-scope.ts`
- `libs/keys/src/providers/keyboard-provider.tsx`
- `libs/keys/src/providers/keyboard-provider.test.tsx`
- `libs/keys/src/hooks/use-key.test.tsx`
- `libs/keys/src/hooks/use-scope.test.tsx`

## Required Fix

- Make implicit scope registration deterministic and aligned with component ownership.
- Prefer explicit scope propagation or provider-supported registration semantics over "whatever active scope exists during effect registration".
- Preserve existing explicit `scope` option behavior.
- Avoid render-phase ref writes or effect hacks that only mask ordering.

## Tests

Add behavior tests for:

- colocated `useScope("modal", { enabled })` and implicit `useKey` when `enabled` flips false -> true;
- `enabled` true -> false does not leave hidden handlers in a popped scope;
- parent/global shortcut mounted in the same commit as a child scope remains global unless explicitly scoped;
- explicitly scoped `useKey(..., { scope: "modal" })` still works;
- StrictMode cleanup/replay remains correct.

## Acceptance Criteria

- The active scope stack and handler scope are predictable.
- Existing global shortcuts, modal shortcuts, and nested scopes still work.
- Tests prove user-visible key behavior rather than only internal maps.
