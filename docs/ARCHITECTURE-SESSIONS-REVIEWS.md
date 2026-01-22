# Stargazer Architecture: Sessions and Reviews

## 0. AI Agent Quick Reference

> **Read this section first** if you're an AI agent implementing features.

### Purpose of This Document

This is the **single source of truth** for Stargazer's Session and Review architecture. Read this before implementing ANY feature related to sessions, reviews, or chat.

### Key File Paths

| Feature | Schema | Storage | Route | CLI Hook |
|---------|--------|---------|-------|----------|
| Sessions | `packages/schemas/src/session.ts` | `packages/core/src/storage/sessions.ts` | `apps/server/src/api/routes/sessions.ts` | `apps/cli/src/features/sessions/hooks/use-session.ts` |
| Reviews | `packages/schemas/src/review-history.ts` | `packages/core/src/storage/review-history.ts` | `apps/server/src/api/routes/reviews.ts` | `apps/cli/src/features/review/hooks/use-review-history.ts` |
| Review Streaming | `packages/schemas/src/review.ts` | - | `apps/server/src/api/routes/review.ts` | `apps/cli/src/features/review/hooks/use-review.ts` |
| AI Client | `packages/core/src/ai/types.ts` | `packages/core/src/ai/providers/gemini.ts` | - | - |

### Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Session CRUD | DONE | Create, read, list, delete sessions |
| Session Messages | DONE | Add messages to sessions |
| Review Streaming | DONE | SSE streaming from AI |
| Review History | DONE | Save and list past reviews |
| **Chat UI** | **NOT DONE** | No interactive chat component |
| **Session-Review Linking** | **NOT DONE** | Schema fields missing |
| **Standalone Review Command** | **NOT DONE** | No `stargazer review` command |

### Patterns Used (Follow These)

1. **Result<T, E>** - Functional error handling, no exceptions
2. **Zod schemas** - Runtime validation on all data
3. **SSE streaming** - For long AI responses
4. **React/Ink** - Terminal UI components
5. **Discriminated unions** - For state machines (idle | loading | success | error)

### Quick Links to Tasks

See `/docs/tasks/README.md` for implementation tasks. Start with TASK-001.

---

## 1. What is Stargazer?

Stargazer is a **local AI code reviewer** built as a TypeScript monorepo. It provides:

- **Chat functionality** - Interactive conversations about code (via Sessions)
- **Code review** - AI-powered analysis of git changes (via Reviews)
- **CLI interface** - Terminal UI built with React/Ink
- **Server backend** - Hono HTTP server with SSE streaming

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.7+ |
| Monorepo | pnpm workspaces + Turborepo |
| CLI UI | React 19 + Ink 6 |
| Server | Hono 4 |
| Validation | Zod 3 |
| AI | Google Gemini via @google/genai |

---

## 2. Storage Architecture

### All data lives in `~/.stargazer/`

```
~/.stargazer/
├── config.json              # Provider/model settings
├── secrets/
│   └── secrets.json         # API keys (fallback if keyring unavailable)
├── sessions/
│   └── {uuid}.json          # Individual session files (conversations)
└── reviews/
    └── {uuid}.json          # Individual review files (code analyses)
```

**Important:** Storage uses `~/.stargazer/` NOT `~/.cache/`. The `.stargazer` folder is the single source of truth for all app data.

### Storage Layer (`packages/core/src/storage/`)

| File | Purpose |
|------|---------|
| `paths.ts` | Path helpers for ~/.stargazer/* |
| `persistence.ts` | Collection/Document abstractions |
| `sessions.ts` | Session CRUD operations |
| `review-history.ts` | Review CRUD operations |
| `config.ts` | Config read/write |

Two abstractions:
- **Document** - Single file (config.json)
- **Collection** - Multiple files (sessions/, reviews/)

Features:
- Atomic writes (temp file + rename)
- Zod schema validation on read/write
- Result<T, E> error handling (no exceptions)
- Safe permissions (0o600 for files, 0o700 for dirs)

---

## 3. Sessions: What They Are and Why

### Definition

A **Session** is a **persistent conversation history** associated with a specific project.

### Current Schema (`packages/schemas/src/session.ts`)

```typescript
// CURRENT IMPLEMENTATION
SessionMetadata = {
  id: string (UUID)
  projectPath: string
  title: string | undefined
  createdAt: string (ISO)
  updatedAt: string (ISO)
  messageCount: number
  // NOTE: relatedReviewIds is NOT YET IMPLEMENTED
}

Session = {
  metadata: SessionMetadata
  messages: SessionMessage[]
}

SessionMessage = {
  id: string (UUID)
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string (ISO)
}
```

### Target Schema (After TASK-002)

```typescript
// TARGET - adds relatedReviewIds
SessionMetadata = {
  ...current fields,
  relatedReviewIds: string[]   // Reviews created during this session
}
```

### Why Sessions Exist

1. **Conversation persistence** - Users can continue where they left off
2. **Context accumulation** - AI has full conversation history for better responses
3. **Project isolation** - Each project has its own conversation threads
4. **History review** - Users can browse past conversations

### User Workflows with Sessions

| Command | Behavior |
|---------|----------|
| `stargazer run` | Create new session |
| `stargazer run -c` | Continue last session for this project |
| `stargazer run -r <id>` | Resume specific session |
| `stargazer run -r` | Show session picker |

### Session Lifecycle

1. **Created** - When user starts chat (new or resumed)
2. **Active** - Messages added via `addMessage(role, content)`
3. **Updated** - `updatedAt` and `messageCount` change with each message
4. **Persisted** - Saved to `~/.stargazer/sessions/{id}.json`
5. **Listed** - Available in Sessions screen (press `H`)
6. **Deleted** - User can remove from history

### Key Characteristic: Sessions are MUTABLE

Sessions grow over time as messages are added. The `updatedAt` timestamp reflects the last activity.

---

## 4. Reviews: What They Are and Why

### Definition

A **Review** is an **AI-powered code analysis report** that evaluates git changes at a point in time.

### Current Schema (`packages/schemas/src/review-history.ts`)

```typescript
// CURRENT IMPLEMENTATION
ReviewHistoryMetadata = {
  id: string (UUID)
  projectPath: string
  createdAt: string (ISO)
  staged: boolean
  branch: string | null
  overallScore: number | null  // 0-10
  issueCount: number
  criticalCount: number
  warningCount: number
  // NOTE: sessionId is NOT YET IMPLEMENTED
}

SavedReview = {
  metadata: ReviewHistoryMetadata
  result: ReviewResult
  gitContext: ReviewGitContext
}
```

### Target Schema (After TASK-001)

```typescript
// TARGET - adds sessionId
ReviewHistoryMetadata = {
  ...current fields,
  sessionId: string | null     // string = linked, null = standalone
}
```

### Review Result Schema (`packages/schemas/src/review.ts`)

```typescript
ReviewResult = {
  summary: string
  issues: ReviewIssue[]
  overallScore: number | null  // 0-10
}

ReviewIssue = {
  severity: "critical" | "warning" | "suggestion" | "nitpick"
  category: "security" | "performance" | "style" | "logic" | "documentation" | "best-practice"
  file: string | null
  line: number | null
  title: string
  description: string
  suggestion: string | null
}
```

### Why Reviews Exist

1. **Instant code analysis** - Get AI feedback on changes before committing/pushing
2. **Structured output** - Issues categorized by severity and type
3. **Historical record** - Track code quality over time
4. **Accountability** - Know what was reviewed and when

### User Workflows with Reviews

| Action | Behavior |
|--------|----------|
| Press `r` in CLI | Review staged changes |
| Press `s` then `r` | Toggle to unstaged, then review |
| View review history | See past reviews with scores |

### Review Lifecycle

1. **Triggered** - User presses `r` or calls `/review/stream`
2. **Streaming** - AI analyzes diff, results stream via SSE
3. **Completed** - Full result available
4. **Saved** - Automatically persisted to `~/.stargazer/reviews/{id}.json`
5. **Historical** - Available in review history
6. **Deleted** - User can remove from history

### Key Characteristic: Reviews are IMMUTABLE

Once created, a review never changes. It's a **point-in-time snapshot** of what the AI found. The `createdAt` timestamp is the only timestamp - there is no `updatedAt`.

---

## 5. Sessions vs Reviews: Side-by-Side

| Aspect | Session | Review |
|--------|---------|--------|
| **Purpose** | Interactive conversation | Code analysis snapshot |
| **Trigger** | User starts chat | User presses `r` |
| **Data shape** | Metadata + messages array | Metadata + result + gitContext |
| **Mutability** | Mutable (grows over time) | Immutable (frozen at creation) |
| **Timestamps** | createdAt + updatedAt | createdAt only |
| **User interaction** | Multi-turn dialogue | Passive viewing |
| **Key metric** | messageCount | issueCount, overallScore |

### Why They're Separate

1. **Different lifecycles** - Sessions evolve, reviews are snapshots
2. **Different purposes** - Conversations vs analysis artifacts
3. **Different data shapes** - Messages vs issues
4. **Independent value** - Each is useful on its own
5. **Industry pattern** - Bugbot, CodeRabbit all separate these concepts

---

## 6. Two Types of Reviews: Linked vs Standalone

Reviews exist in **two distinct modes** - this is NOT optional, it's a fundamental type distinction:

### Type 1: Linked Review (Session + Review)

A review that happens **within the context of a conversation**:
- Triggered while in a chat session
- User can discuss findings, ask questions about issues
- Session tracks all reviews triggered during conversation
- Like CodeRabbit's "agential chat" where you can chat with the AI reviewer

**Data Model:**
```typescript
LinkedReview = {
  ...ReviewHistoryMetadata,
  sessionId: string              // REQUIRED - which session this belongs to
}
```

**User workflow:**
1. User is in a chat session discussing code
2. User triggers review (`r` key)
3. Review is created with `sessionId` pointing to current session
4. Session's `relatedReviewIds` array gets updated
5. User can continue chatting about the review findings
6. AI has full context: conversation history + review results

### Type 2: Standalone Review (Just Review)

A review that happens **independently**, without conversation:
- Triggered directly via API or quick command
- No conversation context
- Like Bugbot's quick PR review - just analyze and report
- Can be promoted to linked by starting a discussion

**Data Model:**
```typescript
StandaloneReview = {
  ...ReviewHistoryMetadata,
  sessionId: null                // EXPLICITLY null - no session
}
```

**User workflow:**
1. User wants quick review without conversation
2. User runs `stargazer review` (standalone command)
3. Review is created with `sessionId: null`
4. Results displayed and saved
5. Later, user can "discuss this review" -> creates new session linked to it

### Why Two Types (Not Optional Linking)

| Aspect | Linked Review | Standalone Review |
|--------|---------------|-------------------|
| **Context** | Full conversation history | None (just the diff) |
| **Interaction** | Multi-turn (discuss findings) | One-shot (view and done) |
| **AI knowledge** | Knows previous discussion | Fresh context each time |
| **Use case** | Deep code discussion | Quick pre-commit check |
| **Entry point** | From within session | Direct command/API |

### Workflows

**Starting a linked review (from session):**
1. User is in session -> presses `r`
2. System creates review with `sessionId: currentSession.id`
3. System adds `review.id` to `session.relatedReviewIds`
4. User can chat about findings

**Starting a standalone review:**
1. User runs `stargazer review` directly
2. System creates review with `sessionId: null`
3. Results displayed, saved to history
4. No session created

**Promoting standalone to linked:**
1. User views standalone review in history
2. Presses "Discuss" or `d`
3. System creates new session with review context
4. System updates review's `sessionId` to new session
5. System adds review to session's `relatedReviewIds`

---

## 7. Package Structure

```
packages/
├── schemas/              # Zod schemas (leaf package, no dependencies)
│   ├── session.ts        # Session/SessionMessage schemas
│   ├── review.ts         # ReviewIssue/ReviewResult schemas
│   ├── review-history.ts # SavedReview/ReviewHistoryMetadata
│   └── config.ts         # UserConfig schema
│
├── core/                 # Business logic (depends on schemas)
│   ├── storage/
│   │   ├── paths.ts      # ~/.stargazer/* path helpers
│   │   ├── persistence.ts # Collection/Document abstractions
│   │   ├── sessions.ts   # Session operations
│   │   ├── review-history.ts # Review operations
│   │   └── config.ts     # Config operations
│   ├── secrets/          # API key management
│   └── ai/               # AI provider clients (Gemini)
│
└── api/                  # HTTP client for CLI->Server

apps/
├── server/               # Hono HTTP backend
│   ├── api/routes/
│   │   ├── sessions.ts   # Session CRUD + messaging
│   │   ├── reviews.ts    # Review history CRUD
│   │   └── review.ts     # Streaming review endpoint
│   └── services/
│       └── review.ts     # Review logic (prompt, sanitization)
│
└── cli/                  # React/Ink terminal UI
    ├── commands/
    │   └── run.ts        # Entry point with session modes
    └── features/
        ├── chat/         # Chat screen components (NOT YET IMPLEMENTED)
        ├── review/       # Review screen components
        └── sessions/     # Session management
```

### Reusability Principle

| Location | What Goes Here | Why |
|----------|----------------|-----|
| `packages/schemas/` | All Zod schemas, types | Shared by CLI, web, GitHub Action |
| `packages/core/` | Storage, AI client, business logic | Reusable across surfaces |
| `packages/api/` | HTTP client factory | Used by any frontend |
| `apps/cli/` | React/Ink components | CLI-specific UI |
| `apps/server/` | HTTP routes, SSE streaming | Backend for all frontends |
| `apps/web/` (future) | Browser UI | Web-specific |
| `apps/github-action/` (future) | PR integration | GitHub-specific |

> **Rule:** If it's used by multiple surfaces -> `packages/`. If it's surface-specific UI -> `apps/`.

---

## 8. Future Architecture: Multi-Surface Review

### Vision

Same review logic, multiple surfaces:
1. **CLI** - Current interactive terminal
2. **Web UI** - Browser interface (via `/web` command)
3. **GitHub Action** - Bugbot-style PR comments

### Key Insight

The **review logic** (prompts, parsing, sanitization) should be **extracted** into a reusable package that all surfaces can import.

### Project Summary for Context

Use Gemini's 2M context window to understand the codebase:
1. Generate project summary (file tree, dependencies, patterns)
2. Cache summary in `~/.stargazer/summaries/{project-hash}.json`
3. Include summary in review prompt for context-aware analysis

---

## 9. Summary

| Concept | What It Is | Key Property |
|---------|------------|--------------|
| **Session** | Conversation thread | Mutable, grows with messages |
| **Linked Review** | Review within a session | Has `sessionId`, enables discussion |
| **Standalone Review** | Quick one-shot review | `sessionId: null`, no conversation |
| **Storage** | `~/.stargazer/*` | Single source of truth |
| **Summary** | Project context for AI | Cached, used for better reviews |

### The Two Review Types

```
+-------------------------------------------------------------+
|                    LINKED REVIEW                            |
|  +-------------+         +-------------+                    |
|  |   Session   |<------->|   Review    |                    |
|  |  (chat)     | linked  |  (analysis) |                    |
|  +-------------+         +-------------+                    |
|  User can discuss findings, ask questions, continue chat    |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
|                   STANDALONE REVIEW                         |
|                      +-------------+                        |
|                      |   Review    |                        |
|                      |  (analysis) |                        |
|                      +-------------+                        |
|  Quick code check, no conversation, can promote to linked   |
+-------------------------------------------------------------+
```

This architecture matches industry patterns:
- **Bugbot** - Standalone reviews (just analyze PR)
- **CodeRabbit** - Linked reviews (chat with reviewer)
- **Stargazer** - Both modes available

---

## 10. Implementation Tasks

See `/docs/tasks/README.md` for the full task list with detailed specifications.

### Task Order (Logic-First Approach)

**Layer 1: Schema (Foundation)**
- TASK-001: Add `sessionId` to ReviewHistoryMetadata
- TASK-002: Add `relatedReviewIds` to SessionMetadata

**Layer 2: Storage (Core Logic)**
- TASK-003: Update storage functions for new fields
- TASK-010: Create linkReviewToSession function

**Layer 3: API (Server Endpoints)**
- TASK-004: Create chat streaming endpoint
- TASK-009: Add review update endpoint
- TASK-011: Update saveReview for linked reviews

**Layer 4: CLI UI (Basic Wiring)**
- TASK-005: Build ChatDisplay component
- TASK-006: Build MessageItem component
- TASK-007: Build ChatInput component
- TASK-008: Wire chat view into app.tsx
- TASK-012: Add "Discuss Review" action

**Layer 5: CLI Command**
- TASK-013: Add standalone review command

**Layer 6: Tests**
- TASK-014: Setup vitest infrastructure
- TASK-015: Add schema unit tests
- TASK-016: Add storage integration tests

### Agent Assignments

| Agent | Tasks |
|-------|-------|
| `typescript-pro` | TASK-001, TASK-002 |
| `backend-developer` | TASK-003, TASK-004, TASK-010, TASK-011, TASK-013 |
| `react-component-architect` | TASK-005, TASK-006, TASK-007, TASK-008, TASK-012 |
| `api-architect` | TASK-009 |
| `test-automator` | TASK-014, TASK-015, TASK-016 |
