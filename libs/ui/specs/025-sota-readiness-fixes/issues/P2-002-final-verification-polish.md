# P2-002: Final 5/5 polish and verification gates

Area: Tests / docs validation / consumer matrix / release checks
Severity: P2
Effort: Medium

## Problem

The repo has strong gates, but the final 10x3 re-audit identified a few gaps that should be closed for a 5/5 handoff.

## Evidence

- Policy file tracking is not checked by `validate:artifacts`.
- Docs composition contract drift is not statically guarded.
- Docs command gating scans representative files, not every public install snippet.
- Browser-level form validity is not fully proven outside jsdom.
- Yarn PnP is neither supported nor explicitly excluded in package-mode Tailwind docs.

## User Impact

Small documentation and release errors can reappear without failing CI. Some consumer compatibility claims are broader than current proof.

## Fix

- Add targeted static checks where cheap.
- Document unsupported Yarn PnP package-mode constraints or add a narrow verification path.
- Keep broader package-manager matrix as a release/post-publication gate, not a blocker for local/tarball handoff.

## Acceptance Criteria

- CI/gates catch stale package policy files and stale generated docs.
- Public install snippets are either local-first or explicitly publish-gated.
- Yarn PnP stance is documented.
- No `.bak` or temporary artifacts are introduced.

## Verification

- Static docs tests.
- Artifact validation.
- Clean `git diff --check`.
- Final `rg` checks for banned docs phrases and deprecated example props.

