# QLT-001: React Render-Phase Ref Write Remains In useKey

Area: React 19 hooks/effects/refs

Severity: High

Priority: P2, top quality gate

Effort: S

## Problem

`useKey` still mutates a ref during render to keep the latest handler map. This is the exact ref trampoline pattern the audit was asked to catch.

## Evidence

- `libs/keys/src/hooks/use-key.ts:53` assigns `handlerMapRef.current = handlerMap` during render.
- `libs/keys/src/hooks/use-key.test.tsx:105` verifies latest-handler behavior, but currently blesses the render-time ref mutation approach.
- Targeted `rg` scan confirmed this is the remaining `handlerMapRef.current = handlerMap` source hit outside generated output.

## User Impact

The hook is not React-pure. It can become brittle under concurrent rendering, Strict Mode, and future compiler assumptions. It also teaches consumers the wrong latest-callback pattern.

## Fix

Replace the render-time ref trampoline with React 19 `useEffectEvent`, or re-register on handler identity changes if stable no-reregister behavior is not required.

## Acceptance Criteria

- No `.current =` assignment runs during render in `use-key.ts`.
- Latest handler after rerender still works.
- Changing the key map re-registers correctly.
- Strict Mode mount/cleanup does not leak duplicate registrations.

## Verification

Run `pnpm --filter @diffgazer/keys test`, add a Strict Mode registration cleanup test, and keep a targeted scan for render-phase ref writes.

