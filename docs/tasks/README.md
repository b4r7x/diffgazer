# Implementation Tasks

This folder contains detailed task specifications for implementing Stargazer features. Each task is designed to be completed by an AI agent with empty context.

## How to Use These Tasks

1. **Read the architecture doc first**: `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md`
2. **Pick a task** from the list below (follow the order for dependencies)
3. **Read the task file** completely before starting
4. **Implement** following the exact specifications
5. **Verify** using the commands in each task
6. **Run `pnpm build && pnpm typecheck`** after every change

## Principles

- **KISS** - Keep it simple, don't over-engineer
- **YAGNI** - Only implement what's specified, nothing more
- **DRY** - Reuse existing patterns from the codebase

## Task Index

### Layer 1: Schema (Foundation)

| Task | Description | Agent | Status |
|------|-------------|-------|--------|
| [TASK-001](./TASK-001-add-sessionId-schema.md) | Add `sessionId` to ReviewHistoryMetadata | `typescript-pro` | TODO |
| [TASK-002](./TASK-002-add-relatedReviewIds-schema.md) | Add `relatedReviewIds` to SessionMetadata | `typescript-pro` | TODO |

### Layer 2: Storage (Core Logic)

| Task | Description | Agent | Status |
|------|-------------|-------|--------|
| [TASK-003](./TASK-003-update-storage-functions.md) | Update storage for new schema fields | `backend-developer` | TODO |
| [TASK-010](./TASK-010-link-review-function.md) | Create linkReviewToSession function | `backend-developer` | TODO |

### Layer 3: API (Server Endpoints)

| Task | Description | Agent | Status |
|------|-------------|-------|--------|
| [TASK-004](./TASK-004-chat-streaming-endpoint.md) | Create chat streaming endpoint | `backend-developer` | TODO |
| [TASK-009](./TASK-009-review-update-endpoint.md) | Add review update endpoint | `api-architect` | TODO |
| [TASK-011](./TASK-011-save-linked-review.md) | Update saveReview for linked reviews | `backend-developer` | TODO |

### Layer 4: CLI UI (Basic Wiring)

| Task | Description | Agent | Status |
|------|-------------|-------|--------|
| [TASK-005](./TASK-005-chat-display-component.md) | Build ChatDisplay component | `react-component-architect` | TODO |
| [TASK-006](./TASK-006-message-item-component.md) | Build MessageItem component | `react-component-architect` | TODO |
| [TASK-007](./TASK-007-chat-input-component.md) | Build ChatInput component | `react-component-architect` | TODO |
| [TASK-008](./TASK-008-wire-chat-view.md) | Wire chat view into app.tsx | `react-component-architect` | TODO |
| [TASK-012](./TASK-012-discuss-review-action.md) | Add "Discuss Review" action | `react-component-architect` | TODO |

### Layer 5: CLI Command

| Task | Description | Agent | Status |
|------|-------------|-------|--------|
| [TASK-013](./TASK-013-standalone-review-command.md) | Add standalone review command | `backend-developer` | TODO |

### Layer 6: Tests

| Task | Description | Agent | Status |
|------|-------------|-------|--------|
| [TASK-014](./TASK-014-test-infrastructure.md) | Setup vitest infrastructure | `test-automator` | TODO |
| [TASK-015](./TASK-015-schema-unit-tests.md) | Add schema unit tests | `test-automator` | TODO |
| [TASK-016](./TASK-016-storage-integration-tests.md) | Add storage integration tests | `test-automator` | TODO |

## Dependencies

```
TASK-001 ─┬─► TASK-003 ─► TASK-011 ─► TASK-008
TASK-002 ─┘              │
                         └─► TASK-010 ─► TASK-012

TASK-004 ─► TASK-005 ─► TASK-006 ─► TASK-007 ─► TASK-008

TASK-009 ─► TASK-010

TASK-008 ─► TASK-013

TASK-014 ─► TASK-015 ─► TASK-016
```

## Task File Format

Each task file follows this structure:

```markdown
# TASK-XXX: [Name]

## Metadata
- Priority, Agent, Dependencies, Package

## Context
- What you need to understand

## Current State
- Actual code that exists now

## Target State
- Exact code you should write

## Files to Modify
- List of files and what to change

## Acceptance Criteria
- Checkboxes for verification

## Verification
- Commands to run

## Notes
- Important considerations
```

## Agents Reference

| Agent | Expertise | Use For |
|-------|-----------|---------|
| `typescript-pro` | TypeScript, Zod, types | Schema changes, type definitions |
| `backend-developer` | Node.js, Hono, storage | Server routes, storage functions |
| `react-component-architect` | React, Ink, hooks | CLI components, state management |
| `api-architect` | REST API design | Endpoint design, request/response |
| `test-automator` | Vitest, testing | Test setup, unit/integration tests |

## Quick Commands

```bash
# After any change
pnpm build
pnpm typecheck

# Run specific package
pnpm --filter @repo/schemas build
pnpm --filter @repo/core build

# Start dev server
pnpm dev
```
