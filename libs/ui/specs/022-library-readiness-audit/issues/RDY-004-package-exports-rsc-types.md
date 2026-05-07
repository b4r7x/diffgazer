# RDY-004: Package Exports, RSC Boundaries, And Types Are Not Stable Enough

Area: npm package contract

Severity: P0

Effort: M

## Problem

The runtime package exposes an incomplete and noisy public contract. Some generated components are not package-exported, source-copy entry barrels lack client directives, and generated declarations expose broad inferred unions.

## Evidence

- `libs/ui/registry.json:236` and `libs/ui/registry.json:728` define hidden registry items `portal` and `dialog-shell`.
- `libs/ui/package.json:140` onward does not export `components/portal` or `components/dialog-shell`, even though dist contains generated files for them.
- `libs/ui/registry/ui/button/index.ts:1` is a source entry barrel without `"use client"` while the leaf and generated registry JSON carry client expectations.
- `libs/ui/public/r/button.json:16` exposes source-copy install data that depends on client boundaries being preserved correctly.
- `libs/ui/tsup.config.ts:148` builds entry barrels, but source-copy consumers can see different client-boundary behavior than package consumers.
- `libs/ui/dist/_types/registry/ui/button/button.d.ts:38` and `libs/ui/dist/_types/registry/ui/sidebar/sidebar-item.d.ts:26` expose very broad inferred return unions.

## User Impact

Consumers can import a documented/internal dependency in copy mode but not package mode, hit RSC boundary errors in Next App Router, or see unusable public IntelliSense and declaration surfaces.

## Fix

Make package exports, source-copy boundaries, and public declarations explicit.

Concrete fix:

- Export every generated runtime component that is reachable by public components, or move hidden helpers fully private.
- Add `"use client"` to source entry barrels for client components, or generate entry files that preserve the directive.
- Mark pure non-client files with explicit metadata so source-copy does not add unnecessary client boundaries.
- Add explicit component return types or helper component types for components with broad inferred unions.

## Acceptance Criteria

- Every import emitted by installed registry items resolves in package mode and copy mode.
- Next App Router can import each documented component without RSC boundary errors.
- `components/portal` and `components/dialog-shell` have a deliberate public/private decision reflected in package exports and registry metadata.
- Public `.d.ts` files for Button and SidebarItem expose readable component types rather than huge inferred unions.

## Verification

Clean consumer checks:

- Vite package-mode import of each exported component.
- Next App Router page imports `Button`, `Dialog`, `Popover`, `Select`, `Toast`, and `Logo`.
- Source-copy install of `dialog` builds in Next.
- `tsc --noEmit` succeeds and declaration snapshots are reviewed.

