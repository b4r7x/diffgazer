# QLT-013 - Test coverage misses high-risk user behavior

**Area**: Tests and confidence  
**Priority**: P2  
**Severity**: Medium/High  
**Effort**: Medium/Large

## Problem

The test suite is broad and currently passes, but it misses high-risk behavior paths for reusable UI: observer-driven updates, modal focus containment, strict/RSC/SSR behavior, and test isolation.

## Evidence

- `libs/ui/test-setup.ts:18` defines global browser mocks.
- `libs/ui/registry/hooks/testing/use-active-heading.test.ts:22` calls global unstubbing that can affect later tests.
- `libs/ui/vitest.config.ts:13` runs jsdom setup.
- `libs/ui/registry/hooks/use-overflow-items.ts:64` and `use-floating-position.ts:205` depend on observers/listeners.
- `libs/ui/registry/ui/dialog/dialog.test.tsx:68` does not cover full modal focus containment.
- `libs/ui/registry/ui/popover/popover.test.tsx:252` has stronger focus cases than dialog.
- `libs/ui/vitest.config.ts:14` has no SSR/StrictMode project.
- Existing local run passed 42 files and 389 tests, but that did not cover consumer fixtures.

## User Impact

Focus, positioning, cleanup, SSR, and StrictMode regressions can ship despite a green package test run.

## Fix

Centralize browser mock lifecycle, avoid per-test global unstubbing, add controllable observer helpers, add dialog focus trap/return tests, add SSR/StrictMode tests for public exports/hooks, and add consumer fixture smokes.

## Acceptance Criteria

- Shuffled test order keeps mocks stable.
- Observer/listener-driven behavior updates and cleans up.
- Dialog focus cycles and returns correctly.
- Representative public exports render server-side without crashing.
- StrictMode user actions call change handlers once.

## Verification

Run package tests with shuffled order if supported, SSR/node tests, StrictMode behavior tests, and clean Vite/Next fixture builds.

