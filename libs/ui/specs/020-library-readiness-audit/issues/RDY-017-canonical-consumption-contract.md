# RDY-017 - Canonical consumption and migration contract is missing

**Area**: product contract, docs, release support  
**Severity**: High  
**Effort**: Medium  
**Status**: Open

## Problem

The public story does not clearly choose a canonical handoff path or support contract across npm runtime package, shadcn-style registry copy, `dgadd`, and manual source copy.

Users need to know which path is recommended, which paths are supported, how copied code receives updates, and how semver applies across `@diffgazer/ui`, `@diffgazer/add`, `@diffgazer/keys`, and registry artifacts.

## Evidence

- `libs/ui/README.md:5` leads with npm runtime installation.
- `cli/add/README.md:3` describes a copy-first installer where users own copied files.
- `apps/docs/src/components/docs-mdx/blocks/install-command.tsx:12` uses `logoText` to generate CLI commands, which mixes product branding with executable install commands.
- `apps/docs/config/docs-libraries.json:11` references artifact package metadata for generated docs, but `@diffgazer/ui-artifacts` is not present as a publishable package in the current workspace.
- `cli/add/README.md:82` says `dgadd diff` compares local files with the latest registry versions, while the current CLI uses generated bundled registry data.
- `libs/ui/README.md:32` marks `@diffgazer/keys` optional even though documented npm component imports can statically depend on it.

## User Impact

Users can choose the wrong integration path, expect update behavior that does not exist, or treat copied source and runtime package imports as equivalent when they have different CSS, dependency, and migration constraints.

## Fix

Define the public contract:

- recommended primary path for new users;
- supported secondary paths and their limitations;
- versioning rules for copied source, npm package imports, CLI bundle versions, and keys integrations;
- migration/update workflow for `dgadd diff`;
- support matrix for Vite, Next App Router, SSR, Tailwind v4, and package managers.

Generate docs from this contract instead of inferring commands from branding fields.

## Acceptance Criteria

- README, hosted docs, CLI help, and package metadata describe the same consumption modes.
- Every mode documents required dependencies, CSS, Tailwind `@source`, aliases, RSC behavior, and keys integration.
- `dgadd diff` docs match whether it compares bundled or remote registry versions.
- A release checklist covers semver and migration notes for runtime-package users and copied-source users.

## Verification

- Docs command lint for all install snippets.
- Clean consumer smoke tests for the documented primary path and each supported secondary path.
- Release dry-run checklist verifies changelog, package versions, registry bundle versions, and migration notes.
