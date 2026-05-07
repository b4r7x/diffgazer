# RDY-006: Package surface and optional dependency policy need polish

Area: npm package surface / dependency policy / runtime resilience
Severity: P2
Effort: Medium

## Problem

Package-mode is close, but the packed surface and dependency policy still carry polish gaps.

## Evidence

- `dist/_types/registry/**` internals are physically packed because public declarations depend on staged declaration files.
- Hidden runtime internals are excluded from exports/files, but hidden declaration internals remain in `_types`.
- Governance text describes `figlet` as direct runtime dependency, while `libs/ui/package.json` marks it as an optional peer.
- No-optional-figlet smoke is narrower than all common non-figlet exports.
- `toast()` uses unguarded `crypto.randomUUID()`: `libs/ui/registry/ui/toast/toast-store.ts:101`.

## User Impact

Consumers see internal type implementation structure in the tarball, optional dependency expectations can be unclear, and unusual runtimes without `crypto.randomUUID` can fail on toast creation.

## Fix

Generate public `.d.ts` outputs that do not require shipping `_types`, or document why `_types` is intentionally packed until declaration bundling is improved. Align figlet governance/docs/package metadata. Expand no-figlet smoke to import every non-figlet export. Add a safe fallback for toast IDs.

## Acceptance Criteria

- Pack output either excludes `_types/**` or explicitly validates only required declaration internals.
- Figlet docs/governance/package metadata agree on optional-peer semantics.
- All non-figlet public exports import without `figlet`.
- `toast({ title: "x" })` works when `globalThis.crypto?.randomUUID` is absent.

## Verification

- `pnpm --filter @diffgazer/ui pack --dry-run --json`
- `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke:packages`
- Add a no-crypto toast unit/smoke test.

