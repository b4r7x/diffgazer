# RDY-003: Docs Install Handoff Is Still Inconsistent

Area: Docs and user handoff

Severity: High

Priority: P1

Effort: M

## Problem

Rendered component pages have an Installation heading with no install command, and some keys CLI docs still present public `npx @diffgazer/add` commands as primary runnable commands before publication. Some UI integration docs link to a nonexistent keys API route.

## Evidence

- Component pages render `<InstallCommand />` under `## Installation`, for example `libs/ui/docs/content/components/button.mdx:11`.
- `apps/docs/config/docs-libraries.json` has no UI installer configured.
- `apps/docs/src/lib/docs-library.ts:53` returns `null` when a library has no installer.
- `apps/docs/src/lib/docs-library.test.ts:49` asserts UI and keys install commands are null while packages are unpublished.
- Keys CLI docs include public `npx @diffgazer/add` commands in pages such as `libs/keys/docs/content/cli/index.mdx`.
- UI integration docs reference `/keys/docs/api/reference`, while the actual keys API route is `/keys/docs/api`.

## User Impact

Users can land on component docs and see an empty Installation section. They can also copy commands that are publish-gated or follow broken docs links while trying to decide between copy mode and package mode.

## Fix

Hide empty Installation sections until an installer is configured, or render a publish-gated local tarball command with explicit wording. Standardize keys CLI pages to local tarball plus `pnpm exec dgadd` before publication. Replace `/keys/docs/api/reference` links with `/keys/docs/api`.

## Acceptance Criteria

- No rendered docs page has an empty Installation section.
- No docs page presents public `npx`, `pnpm dlx`, or `npm install @diffgazer/*` commands as available unless immediately marked publish-gated.
- UI and keys docs use one local validation command style.
- All keys API links resolve.

## Verification

Run `pnpm --filter @diffgazer/docs type-check`, `pnpm --filter @diffgazer/docs build`, and a docs route/link smoke that checks component pages for non-empty Installation sections or no Installation heading.

