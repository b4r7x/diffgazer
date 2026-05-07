# RDY-007: Docs Handoff Snippets Are Inconsistent

Area: Documentation and examples

Severity: P1

Effort: M

## Problem

Getting-started docs are close, but several snippets do not match a clean consumer setup or the current product state.

## Evidence

- `libs/ui/docs/content/getting-started/installation.mdx:47`, `libs/ui/docs/content/getting-started/typescript.mdx:25`, and `libs/ui/docs/content/getting-started/tailwind-setup.mdx:16` show Vite config snippets without `import { defineConfig } from "vite"`.
- `libs/ui/docs/content/getting-started/installation.mdx:59`, `libs/ui/docs/content/getting-started/installation.mdx:76`, and `libs/ui/docs/content/getting-started/installation.mdx:135` omit `src/styles/styles.css` from result trees even though users must import CSS.
- `libs/ui/docs/content/cli/add.mdx:8`, `libs/ui/docs/content/cli/list.mdx:8`, `libs/ui/docs/content/cli/diff.mdx:8`, and `libs/ui/docs/content/cli/remove.mdx:8` show public `npx @diffgazer/add@latest` commands without a local fallback gate.
- `libs/keys/README.md:5-8` shows unconditional public npm install for an unpublished package.
- `cli/add/README.md:26-32` repeats public quick-start commands.
- `libs/ui/docs/content/changelog.mdx:6`, `libs/ui/docs/content/changelog.mdx:10-16`, and `libs/ui/docs/content/changelog.mdx:20-24` contain stale date and component/status copy.
- `libs/ui/docs/content/integrations/keys.mdx:21` and `libs/ui/docs/content/patterns/keyboard-navigation.mdx:10` show current keyboard integration that contradicts stale changelog positioning.

## User Impact

Users copy snippets that do not compile, do not include required CSS files, or point to unavailable package/registry endpoints. The changelog makes support and migration status unclear.

## Fix

Treat docs snippets as executable handoff artifacts.

Concrete fix:

- Add missing Vite imports.
- Keep result trees aligned with installed/generated files.
- Gate public npm snippets until packages are published.
- Refresh changelog, migration, and positioning copy against current package capabilities.
- Add docs snippet tests or smoke extraction where possible.

## Acceptance Criteria

- Every getting-started snippet compiles in a clean consumer project.
- Docs never reference unavailable public commands as the default path.
- Result trees match actual installed files.
- Changelog date, component count, and keyboard integration status match the repo.

## Verification

- Extract install snippets into clean Vite and Next fixtures.
- Run `pnpm install`, `pnpm type-check`, and `pnpm build`.
- Review all CLI docs pages for one consistent public/private command story.

