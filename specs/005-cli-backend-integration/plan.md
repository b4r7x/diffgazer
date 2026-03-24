# Implementation Plan: CLI Backend Integration

**Branch**: `005-cli-backend-integration` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-cli-backend-integration/spec.md`

## Summary

Replace all mock data and TODO stubs in the diffgazer CLI (13 screens, 82 source files) with real backend API calls via `@diffgazer/api`. The CLI already has a complete Ink UI and embedded server infrastructure — this work connects the UI layer to the data layer. Key integration points: SSE streaming for reviews (using shared `@diffgazer/core` reducer), config/settings CRUD, provider management, review history, and server health gating.

Execution strategy: 3 waves with up to 30 parallel agents per wave, 36 total tasks.

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), ESM only, .js extensions in imports
**Primary Dependencies**: Ink 6.8.0, React 19.2.4, `@diffgazer/api`, `@diffgazer/core`, `@diffgazer/schemas`, Hono (embedded server), ink-spinner, chalk, @inkjs/ui
**Storage**: Server-managed (JSON files at `~/.diffgazer/`). CLI does not access storage directly — all through API.
**Testing**: vitest (available but CLI has no tests currently — testing is out of scope for this integration)
**Target Platform**: macOS/Linux terminal, Node.js 20+
**Project Type**: CLI application (terminal UI via Ink/React)
**Performance Goals**: Real-time SSE event rendering with no perceptible lag, <5s error detection for server failures
**Constraints**: Terminal width 40-200+ columns, localhost-only server (port 3000)
**Scale/Scope**: 13 screens, 18 UI components, 24 mock data locations to replace, 25+ API endpoints to consume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No project constitution defined (template is blank). Gate passes by default — no constraints to enforce.

**Post-Phase 1 re-check**: Still passes. No constitution gates to violate.

## Project Structure

### Documentation (this feature)

```text
specs/005-cli-backend-integration/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Entity definitions and data flow
├── quickstart.md        # Phase 1: Developer quickstart guide
├── contracts/
│   └── api-consumption.md  # Phase 1: API endpoint usage contract
├── checklists/
│   └── requirements.md     # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/cli/src/
├── lib/
│   └── api.ts                          # NEW: API client singleton
├── hooks/
│   ├── use-server-status.ts            # NEW: Server health polling
│   ├── use-config-guard.ts             # NEW: Config check + onboarding redirect
│   ├── use-init.ts                     # NEW: Init data fetch + provide
│   ├── use-settings.ts                 # NEW: Settings fetch helper
│   └── use-exit-handler.ts             # EXISTING (unchanged)
├── app/
│   ├── index.tsx                       # MODIFY: Add health gate + config guard
│   ├── providers/
│   │   └── server-provider.tsx         # MODIFY: Pass API ready signal
│   └── screens/
│       ├── home-screen.tsx             # MODIFY: Real init data
│       ├── history-screen.tsx          # MODIFY: Real reviews data
│       ├── help-screen.tsx             # UNCHANGED
│       └── settings/
│           ├── hub-screen.tsx          # MODIFY: Real current values
│           ├── theme-screen.tsx        # MODIFY: Fix TODO (keep local)
│           ├── providers-screen.tsx    # MODIFY: Real providers + API calls
│           ├── storage-screen.tsx      # MODIFY: Load + save via API
│           ├── analysis-screen.tsx     # MODIFY: Load + save via API
│           ├── agent-execution-screen.tsx  # MODIFY: Load + save via API
│           ├── diagnostics-screen.tsx  # MODIFY: Real health data
│           └── trust-permissions-screen.tsx # MODIFY: Load + save via API
├── features/
│   ├── review/
│   │   ├── hooks/
│   │   │   ├── use-review-stream.ts       # REWRITE: Real SSE streaming
│   │   │   ├── use-review-lifecycle.ts    # REWRITE: Real state machine
│   │   │   └── use-review-keyboard.ts     # UNCHANGED
│   │   └── components/
│   │       ├── review-container.tsx        # MODIFY: Connect to real lifecycle
│   │       ├── review-progress-view.tsx   # MODIFY: Real event data transforms
│   │       ├── review-summary-view.tsx    # MODIFY: Real summary data
│   │       ├── review-results-view.tsx    # MODIFY: Real issues
│   │       ├── issue-list-pane.tsx        # MODIFY: Real issue data
│   │       └── issue-details-pane.tsx     # MODIFY: Real detail tabs
│   ├── home/components/
│   │   ├── context-sidebar.tsx            # MODIFY: Real provider/trust data
│   │   └── trust-panel.tsx                # MODIFY: Real trust save
│   ├── history/components/
│   │   ├── timeline-list.tsx              # MODIFY: Real review data
│   │   └── history-insights-pane.tsx      # MODIFY: Real review details
│   ├── onboarding/components/
│   │   ├── onboarding-wizard.tsx          # MODIFY: API persistence on complete
│   │   └── steps/
│   │       ├── provider-step.tsx          # MODIFY: Real provider list
│   │       └── model-step.tsx             # MODIFY: Real model list
│   ├── providers/components/
│   │   ├── provider-list.tsx              # MODIFY: Real provider statuses
│   │   ├── provider-details.tsx           # MODIFY: Real details
│   │   ├── api-key-overlay.tsx            # MODIFY: Real save
│   │   └── model-select-overlay.tsx       # MODIFY: Real models
│   └── settings/components/
│       └── analysis-selector.tsx          # MODIFY: Real agents list
└── components/layout/
    ├── global-layout.tsx                  # MODIFY: Real provider in header
    └── header.tsx                         # MODIFY: Real provider status
```

**Structure Decision**: No new directories needed. All changes are modifications to existing files plus 5 new hook/lib files. Follows the existing feature-based organization.

## Implementation Waves

### Wave 1: Foundation (Sequential, 6 tasks)

These must complete before any screen integration can begin. They establish the API client, health gating, config guard, and shared data-fetching patterns.

| Task | Description | Files | Depends On |
|------|-------------|-------|-----------|
| **F1** | Create API client singleton | `lib/api.ts` (new) | — |
| **F2** | Create server health hook | `hooks/use-server-status.ts` (new) | F1 |
| **F3** | Add health gate to App component | `app/index.tsx` | F2 |
| **F4** | Create init data hook | `hooks/use-init.ts` (new) | F1 |
| **F5** | Create settings fetch hook | `hooks/use-settings.ts` (new) | F1 |
| **F6** | Create config guard hook + wire to App | `hooks/use-config-guard.ts` (new), `app/index.tsx` | F3, F4 |

### Wave 2: Screen Integration (Parallel, up to 28 agents)

All tasks in this wave are independent — each modifies a self-contained screen or feature area. Can run with up to 28 parallel Opus agents.

#### Group A: Review Flow (7 tasks)
| Task | Description | Files | Agent |
|------|-------------|-------|-------|
| **R1** | Rewrite review stream hook with real SSE | `features/review/hooks/use-review-stream.ts` | Agent 1 |
| **R2** | Rewrite review lifecycle hook | `features/review/hooks/use-review-lifecycle.ts` | Agent 2 |
| **R3** | Connect review container to real lifecycle | `features/review/components/review-container.tsx` | Agent 3 |
| **R4** | Update review progress view for real events | `features/review/components/review-progress-view.tsx` | Agent 4 |
| **R5** | Update review summary view for real data | `features/review/components/review-summary-view.tsx` | Agent 5 |
| **R6** | Update review results — issue list | `features/review/components/review-results-view.tsx`, `issue-list-pane.tsx` | Agent 6 |
| **R7** | Update review results — issue details tabs | `features/review/components/issue-details-pane.tsx` | Agent 7 |

#### Group B: Home Screen (3 tasks)
| Task | Description | Files | Agent |
|------|-------------|-------|-------|
| **H1** | Home screen init data + context sidebar | `screens/home-screen.tsx`, `features/home/components/context-sidebar.tsx` | Agent 8 |
| **H2** | Trust panel real API | `features/home/components/trust-panel.tsx` | Agent 9 |
| **H3** | Menu item state (resume, disabled states) | `screens/home-screen.tsx` | Agent 10 |

#### Group C: Onboarding (2 tasks)
| Task | Description | Files | Agent |
|------|-------------|-------|-------|
| **O1** | Onboarding wizard API persistence | `features/onboarding/components/onboarding-wizard.tsx` | Agent 11 |
| **O2** | Provider + model steps real data | `steps/provider-step.tsx`, `steps/model-step.tsx` | Agent 12 |

#### Group D: History (2 tasks)
| Task | Description | Files | Agent |
|------|-------------|-------|-------|
| **HI1** | History screen real data | `screens/history-screen.tsx`, `features/history/components/timeline-list.tsx` | Agent 13 |
| **HI2** | History insights + navigation | `features/history/components/history-insights-pane.tsx` | Agent 14 |

#### Group E: Settings Screens (10 tasks)
| Task | Description | Files | Agent |
|------|-------------|-------|-------|
| **S1** | Settings hub — real current values | `screens/settings/hub-screen.tsx` | Agent 15 |
| **S2** | Theme settings — fix TODO (local only) | `screens/settings/theme-screen.tsx` | Agent 16 |
| **S3** | Providers — real list + details | `screens/settings/providers-screen.tsx`, `features/providers/components/provider-list.tsx`, `provider-details.tsx` | Agent 17 |
| **S4** | Providers — API key save | `features/providers/components/api-key-overlay.tsx` | Agent 18 |
| **S5** | Providers — model selector + OpenRouter | `features/providers/components/model-select-overlay.tsx` | Agent 19 |
| **S6** | Storage settings — load + save | `screens/settings/storage-screen.tsx` | Agent 20 |
| **S7** | Analysis settings — load + save | `screens/settings/analysis-screen.tsx`, `features/settings/components/analysis-selector.tsx` | Agent 21 |
| **S8** | Agent execution settings — load + save | `screens/settings/agent-execution-screen.tsx` | Agent 22 |
| **S9** | Diagnostics — real health data | `screens/settings/diagnostics-screen.tsx` | Agent 23 |
| **S10** | Trust permissions — load + save + revoke | `screens/settings/trust-permissions-screen.tsx` | Agent 24 |

#### Group F: Cross-cutting (4 tasks)
| Task | Description | Files | Agent |
|------|-------------|-------|-------|
| **X1** | Header — real provider name + status | `components/layout/global-layout.tsx`, `components/layout/header.tsx` | Agent 25 |
| **X2** | Shutdown flow — real api.shutdown() | `screens/home-screen.tsx` (quit handler) | Agent 26 |
| **X3** | Review screen — saved review loading | `screens/review-screen.tsx` | Agent 27 |
| **X4** | Review screen — mode switching (staged/unstaged) | `screens/review-screen.tsx` | Agent 28 |

### Wave 3: Verification (Parallel, 3 agents)

| Task | Description | Agent |
|------|-------------|-------|
| **V1** | Mock data removal audit — grep for all MOCK_*, TODO, hardcoded data | Agent 29 |
| **V2** | Web-CLI parity audit — compare all 13 screens against web counterparts | Agent 30 |
| **V3** | Terminal responsiveness audit — verify layouts at 40, 80, 120, 200 columns | Agent 31 |

## Agent Dispatch Summary

| Wave | Tasks | Parallel Agents | Sequential? |
|------|-------|----------------|-------------|
| Wave 1: Foundation | 6 | 1 (sequential) | Yes — each depends on prior |
| Wave 2: Screen Integration | 28 | 28 (parallel) | No — all independent |
| Wave 3: Verification | 3 | 3 (parallel) | No — all independent |
| **Total** | **37** | **Max 28 concurrent** | |

## Task Dependencies

```
Wave 1 (Foundation):
  F1 → F2 → F3
  F1 → F4
  F1 → F5
  F3 + F4 → F6

Wave 2 (all depend on Wave 1 completion):
  R1, R2 are independent but R3 consumes output of R1+R2
  R4-R7 depend on R3's interface but can start in parallel (known interface from spec)
  All other tasks (H*, O*, HI*, S*, X*) are fully independent

Wave 3 (depends on Wave 2 completion):
  V1, V2, V3 are fully independent
```

## Per-Agent Prompt Template

Each Wave 2 agent receives a prompt structured as:

```
You are implementing CLI backend integration for the diffgazer project.

CONTEXT:
- The CLI app is at: apps/cli/src/
- The API client singleton is at: apps/cli/src/lib/api.ts (import { api } from "../../lib/api.js")
- Init data hook: apps/cli/src/hooks/use-init.ts (import { useInit } from "../../hooks/use-init.js")
- Settings hook: apps/cli/src/hooks/use-settings.ts (import { useSettings } from "../../hooks/use-settings.js")
- Shared packages: @diffgazer/api, @diffgazer/core, @diffgazer/schemas

YOUR TASK: [specific task description]

FILES TO MODIFY: [list]

REFERENCE (web counterpart): [web file path to mirror]

RULES:
1. Import api from "../../lib/api.js" (relative path, .js extension)
2. Add loading state: show spinner/text while fetching
3. Add error state: show error message on failure
4. Remove ALL mock data, MOCK_* constants, and TODO comments from modified files
5. Use exact field names from @diffgazer/schemas (e.g., defaultLenses not analysisAgents)
6. Do NOT modify files outside your assigned list
7. TypeScript strict mode — no `any`, no `!` assertions
8. ESM imports with .js extensions
```

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| API client not available in Ink environment | `fetch` is global in Node.js 20+ (Ink runs in Node). No polyfill needed. |
| SSE streaming breaks in Node.js | `@diffgazer/api` uses `ReadableStream` from `fetch` response — works natively in Node.js 20+. |
| Parallel agents conflict on shared files | Task decomposition ensures no two agents modify the same file. Exception: `home-screen.tsx` (H1 and X2) — resolved by making X2 a targeted one-line change. |
| `@diffgazer/core` not importable from CLI | Already a workspace dependency of the monorepo. May need adding to `apps/cli/package.json`. |
| Event batching differs in Ink vs browser | Skip `requestAnimationFrame` — Ink/React already batches state updates. Use simple `setTimeout(fn, 0)` if needed. |

## Complexity Tracking

No constitution violations to justify.
