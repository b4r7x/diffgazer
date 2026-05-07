# RDY-003: Install docs still expose unavailable public commands without local-tarball context

Area: Docs / getting started / product positioning
Severity: P1
Effort: Small/Medium

## Problem

Public npm and hosted registry deployment are future-gated, but some likely handoff entry points still show copyable install commands without adjacent context that `@diffgazer/add` must be locally packed/installed before publication.

## Evidence

- Component pages render `<InstallCommand />` near the top: `libs/ui/docs/content/components/button.mdx:9`.
- The install block renders direct `pnpm exec dgadd add ...`: `apps/docs/src/components/docs-mdx/blocks/install-command.tsx:12`.
- CLI README has a publication gate near the top, but foregrounds `npx @diffgazer/add` in Quick Start and command sections: `cli/add/README.md:7`, `cli/add/README.md:28`, `cli/add/README.md:47`, `cli/add/README.md:67`.
- Product CLI docs include an ungated public npm install command: `libs/ui/docs/content/theme/diffgazer.mdx:20`.

## User Impact

Before publication, a user can copy commands that do not work from npm, then conclude the library is broken even though local tarball validation is the intended path.

## Fix

Show local-tarball prerequisites next to component install commands until publication. Move `npx @diffgazer/add` and public npm examples under clearly labeled "After publication" sections. Gate product CLI npm commands the same way.

## Acceptance Criteria

- No component/source install block presents `pnpm exec dgadd` without saying how the binary is available before publication.
- `rg "npx @diffgazer/add|pnpm dlx @diffgazer/add|npm install @diffgazer|npm install -g diffgazer"` shows every public npm command either in an "after publication" section or immediately publish-gated.
- CLI README Quick Start works in a clean fixture before publication using local tarballs.

## Verification

- Build docs and inspect component pages, CLI pages, and the product CLI page.
- Run the local tarball flow in a fresh fixture using only locally packed packages.

