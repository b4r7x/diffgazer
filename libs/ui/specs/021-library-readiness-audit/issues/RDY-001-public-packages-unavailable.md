# RDY-001 - Public install packages are unavailable

**Area**: Public distribution  
**Priority**: P0  
**Severity**: Critical  
**Effort**: Medium

## Problem

The public docs tell users to install or execute packages from npm, but the audit could not verify public npm availability for `@diffgazer/add`, `@diffgazer/ui`, or `@diffgazer/keys` on May 5, 2026.

## Evidence

- `libs/ui/docs/content/getting-started/installation.mdx:11` tells users to run `npx @diffgazer/add init`.
- `apps/docs/config/docs-libraries.json:12` generates `npx @diffgazer/add add`.
- `libs/ui/README.md:33` documents `npm install @diffgazer/ui @diffgazer/keys`.
- Batch B docs audit reported npm registry `404` responses for the three package names on May 5, 2026; independent package search did not find npm package pages.

## User Impact

The first command a user follows can fail before any local project setup starts.

## Fix

Publish `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys` publicly before user handoff, or change all docs/generated install commands to a currently available distribution path.

## Acceptance Criteria

- `npm view @diffgazer/add`, `npm view @diffgazer/ui`, and `npm view @diffgazer/keys` return versions.
- Docs and generated install commands use the same available distribution channel.

## Verification

Run `npm view` for all three packages from a clean machine, then follow the getting-started guide in a fresh Vite React project.

