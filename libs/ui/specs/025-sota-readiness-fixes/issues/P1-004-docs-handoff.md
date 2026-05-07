# P1-004: Docs and handoff snippets are stale or under-gated

Area: Docs / install snippets / package story / theme / React peer floor
Severity: P1
Effort: Medium

## Problem

Docs do not consistently describe the current install/package state, React peer floor, theme CSS, or command palette API. Some commands depend on future publication or undeclared tools.

## Evidence

- Theme docs can still describe the `diffgazer` package or hosted registry as future/current incorrectly: `libs/ui/docs/content/theme/diffgazer.mdx`.
- Dark mode/theme docs can drift from `libs/ui/styles/theme.css`.
- React docs can say only "React 19" even though package peers require `>=19.2.0`: `libs/ui/package.json`, `libs/keys/package.json`, UI and Keys docs.
- CommandPalette docs can still describe context registration or `selectedId` as primary while current code uses highlighted terminology.
- Docs preview uses `npx serve` without declaring `serve` as a package dependency: `apps/docs/package.json`.

## User Impact

Users can copy install commands that do not work yet, install against the wrong React floor, miss required CSS imports, or learn stale APIs.

## Fix

- Gate future public npm/hosted registry commands clearly.
- Keep hosted registry deployment as future non-blocker.
- Use exact React peer wording: React `>=19.2.0` where required.
- Update theme docs to match current CSS tokens and imports.
- Update CommandPalette docs to current API names and composition contract.
- Make docs preview command reproducible without an implicit external `npx` prompt, or document it as requiring `npx` network access.

## Acceptance Criteria

- No public docs present unavailable commands as immediately usable.
- Install docs distinguish local/tarball/copy-first from future public npm/hosted registry.
- React peer floor is consistent across package docs.
- Theme docs match current `theme.css` and package CSS story.
- CommandPalette docs match current code and deprecation status.
- Docs preview command is deterministic in the repo.

## Verification

- Add or update static docs tests for public command gating and React peer wording.
- Add or update `InstallCommand` rendering tests.
- Run docs tests touched by install/docs library changes.

