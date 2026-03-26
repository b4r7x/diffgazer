# Implementation Plan: CLI-Web Shared Infrastructure Consolidation & Quality Audit

**Branch**: `017-cli-web-shared-quality` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-cli-web-shared-quality/spec.md`

## Summary

Consolidate duplicated code between CLI (Ink) and Web (React DOM) apps into shared packages, remove ~150+ lines of confirmed dead code, fix context provider memoization gaps (React Compiler is not installed), deduplicate settings page keyboard boilerplate via existing `useFooterNavigation` hook, and improve code placement across the monorepo. This is a pure refactoring effort — no new features, no new dependencies, no behavioral changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: React 19, Ink 6 (CLI), TanStack Query v5, TanStack Router (web), Vite 7 (web), Zod 4, keyscope (web keyboard), Hono (server)
**Storage**: File-based (JSON config, registry bundles, SHA-256 integrity)
**Testing**: Vitest (packages/core: unit tests, packages/api: planned, apps/web: component + hook tests)
**Target Platform**: Node.js (CLI terminal via Ink), Browser (Web via Vite), macOS/Linux
**Project Type**: Monorepo — CLI app + Web app + shared packages + embedded server
**Performance Goals**: No regression in build time or runtime performance
**Constraints**: All changes must be backward-compatible within the workspace; no new dependencies
**Scale/Scope**: ~120 web source files, ~90 CLI source files, 4 shared packages, ~40 files to modify

## Constitution Check

*GATE: No project-specific constitution defined (template placeholder). No gates to check.*

Pre-design: PASS (no constraints)
Post-design: PASS (no constraints)

## Project Structure

### Documentation (this feature)

```text
specs/017-cli-web-shared-quality/
├── plan.md              # This file
├── research.md          # Phase 0 output - research findings
├── data-model.md        # Phase 1 output - file change manifest
├── quickstart.md        # Phase 1 output - implementation guide
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
packages/
├── core/src/
│   ├── format.ts                    # ADD: getDateKey, getDateLabel, getTimestamp, formatDuration, formatTimestampOrNA
│   ├── layout/breakpoints.ts        # ADD: buildResponsiveResult() utility
│   ├── providers/display-status.ts  # ADD: getProviderStatus (moved from format.ts)
│   └── severity.ts                  # REMOVE (passthrough re-export)
├── api/
│   ├── package.json                 # MODIFY: remove 4 unused subpath exports
│   └── src/hooks/use-review-stream.ts  # MODIFY: import ReviewEvent from core
├── schemas/src/config/providers.ts  # ADD: PROVIDER_CAPABILITIES, OPENROUTER_PROVIDER_ID
└── hooks/                           # REMOVE: entire package (relocate exports)

apps/cli/src/
├── theme/severity.ts                # NEW: shared severityColor() for CLI
├── components/ui/
│   ├── toast.tsx                    # REMOVE (dead code)
│   ├── logo.tsx                     # REMOVE (dead code)
│   ├── scroll-area.tsx              # MODIFY: remove orientation prop
│   ├── navigation-list.tsx          # MODIFY: remove focused prop
│   ├── input.tsx                    # MODIFY: cap widths at container width
│   ├── panel.tsx                    # MODIFY: use constrained width for lines
│   └── section-header.tsx           # MODIFY: use constrained width for lines
├── app/
│   ├── navigation-context.tsx       # MODIFY: add useCallback/useMemo
│   ├── providers/footer-provider.tsx # MODIFY: add useMemo
│   └── screens/review-screen.tsx    # MODIFY: remove ~50 lines dead code
├── features/home/components/
│   ├── info-field.tsx               # MODIFY: replace with KeyValue usage
│   └── context-sidebar.tsx          # MODIFY: use KeyValue instead of InfoField
├── features/review/components/
│   ├── severity-bar.tsx             # MODIFY: import shared severityColor
│   ├── severity-filter-group.tsx    # MODIFY: import shared severityColor
│   └── issue-preview-item.tsx       # MODIFY: dynamic path truncation
├── features/history/components/
│   └── history-insights-pane.tsx    # MODIFY: import shared severityColor
├── hooks/use-terminal-dimensions.ts # MODIFY: use buildResponsiveResult
└── theme/theme-context.tsx          # MODIFY: add useMemo/useCallback

apps/web/src/
├── hooks/
│   ├── use-footer-navigation.ts     # MODIFY: add allowInInput, clamp option
│   ├── use-viewport-breakpoint.ts   # MODIFY: use buildResponsiveResult
│   └── use-openrouter-models.ts     # MODIFY: remove useMemo wrapper
├── app/providers/
│   ├── config-provider.tsx          # MODIFY: add useMemo for both context values
│   └── theme-provider.tsx           # MODIFY: add useMemo, remove setPreview
├── components/layout/footer/
│   ├── footer-context.tsx           # MODIFY: remove useFooter combined hook
│   └── index.ts                     # MODIFY: remove useFooter re-export
├── config/constants.ts              # MODIFY: remove DEFAULT_TTL, move PROVIDER_CAPABILITIES
├── features/settings/
│   ├── index.ts                     # REMOVE (empty barrel)
│   └── components/*/page.tsx        # MODIFY: 4 pages use useFooterNavigation
├── features/onboarding/components/
│   └── onboarding-wizard.tsx        # MODIFY: use useFooterNavigation, fix canProceed duplication
├── features/review/components/
│   ├── page.tsx                     # MODIFY: remove LoadingReviewState, use ReviewLoadingMessage
│   └── review-container.tsx         # MODIFY: export ReviewLoadingMessage
├── features/providers/types/
│   └── index.ts                     # REMOVE (thin re-export)
├── features/history/utils.tsx       # MODIFY: import from @diffgazer/core/format
└── types/theme.ts                   # MODIFY: remove setPreview from interface
```

**Structure Decision**: Existing monorepo structure is preserved. Changes are file-level modifications and relocations, not structural changes. No new packages or directories beyond `apps/cli/src/theme/severity.ts`.

## Complexity Tracking

No constitution violations to justify — the plan adds no new complexity. It reduces complexity by eliminating duplication, dead code, and unnecessary indirection.
