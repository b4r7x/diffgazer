# P2-001: Test, validation, and generated-artifact coverage needs final hardening

Area: Tests / generated artifacts / smoke / validation
Severity: P2
Effort: Medium

## Problem

Many individual fixes are covered, but the final release needs tests that prevent recurrence of the exact audit findings and validation that generated files reflect the source changes.

## Evidence

- Overlay tests did not cover closed-first dialog portal containment or command palette nested portals.
- Existing form tests can assert hidden native control behavior without proving visible accessible invalid behavior.
- Registry validation can pass even when source-copy behavior lacks specific negative fixtures.
- Generated docs/public registry artifacts are large and easy to leave stale.

## User Impact

The repo can look green while the same handoff failures reappear in generated registry output, docs output, or copied consumer code.

## Fix

- Add focused regression tests for every P1 behavior fixed in this spec.
- Add static validation tests for docs install command gating and React peer wording.
- Add generated/artifact validation or smoke assertions where a source-only test would miss copy-first output.
- Regenerate affected docs/public registry files only after source/doc changes are final.

## Acceptance Criteria

- All P1 issues have tests that fail on the audited broken behavior.
- Generated docs/public registry artifacts are synchronized with source/docs.
- Release/readiness validation commands pass from the current worktree.
- No `.bak` or throwaway files are created.

## Verification

- Run focused package tests.
- Run `@diffgazer/ui validate:registry`.
- Run `pnpm run validate:artifacts`.
- Run final package/docs verification commands listed in `spec.md`.

