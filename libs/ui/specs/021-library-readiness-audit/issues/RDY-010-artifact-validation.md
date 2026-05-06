# RDY-010 - Artifact validation allows stale outputs

**Area**: Artifact generation and validation  
**Priority**: P1  
**Severity**: High  
**Effort**: Medium/Large

## Problem

Generated artifacts can be stale, missing, or tampered with while existing validators warn/skip instead of failing.

## Evidence

- Batch B artifact audit recomputed stale UI and keys artifact fingerprints.
- `libs/registry/src/docs/loader.ts:116` fails docs sync on fingerprint mismatch.
- `apps/docs/config/docs-libraries.json:32` points keys docs package mode at `@diffgazer/keys-artifacts`.
- `libs/keys/artifacts/package.json:12` marks that package private.
- `pnpm-workspace.yaml:1` only includes `apps/*`, `cli/*`, and `libs/*`, not `libs/keys/artifacts`.
- `libs/registry/src/fingerprint.ts:12` warns/skips missing fingerprint inputs.
- `libs/registry/src/docs-data/hooks-source.ts:42` skips missing hook source files.
- `libs/registry/src/copy-bundle.ts:103` writes integrity, while `cli/add/src/utils/integration.ts:39` only parses schema at runtime.

## User Impact

Docs and CLI bundles can ship stale registry data or unverified copied hook sources.

## Fix

Add non-mutating `validate:artifacts` gates for fingerprints, `public/r` freshness, docs generated completeness, CLI registry bundle integrity, and keys copy bundle integrity. Make missing inputs and duplicate demo keys fail unless explicitly optional.

## Acceptance Criteria

- Freshness checks pass for UI and keys `public/r`.
- Artifact fingerprints equal recomputed inputs.
- Tampering with `keys-copy-bundle.json` fails CLI load.
- CI package-mode docs sync works from a clean install.

## Verification

Run UI/keys/add builds, root verify, `DIFFGAZER_DEV=1 pnpm --filter @diffgazer/docs prepare:generated`, and `CI=true pnpm --filter @diffgazer/docs prepare:generated`.

