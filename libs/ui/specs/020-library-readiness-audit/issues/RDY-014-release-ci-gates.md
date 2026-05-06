# RDY-014 - Release and CI gates are missing

**Area**: release engineering  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

Public packages need release gates that catch artifact, CSS, RSC, registry, and consumer fixture failures before publish.

## Evidence

- `libs/ui/package.json` has build, type-check, and test scripts.
- `cli/add/package.json` has build and prepublish checks.
- `libs/ui/package.json:43` does not define a `prepublishOnly` gate.
- The current `.github` directory contains only `copilot-instructions.md`; no CI workflow is present.
- Missing gates can still allow CSS side-effect, missing client directive, and registry dependency issues to ship.
- Root package smoke coverage imports only a narrow package surface and does not exercise every public UI subpath, registry copy install, or clean Next/Vite consumer.

## User Impact

Source tests can pass while published artifacts are broken.

## Fix

Add CI/release workflows that run frozen install, typecheck, tests, registry validation, npm build, CLI build, pack dry-run, and clean consumer smoke tests.

## Acceptance Criteria

- No package can publish without full validation.
- CI runs on PRs.
- Release workflow is reproducible.

## Verification

- Deliberately missing CSS or client directive fails CI.
