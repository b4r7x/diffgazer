# CLI Application

React Ink terminal UI for AI-powered code review. The CLI starts a local server and provides an interactive interface.

## Quick Start

```bash
# Start interactive TUI
stargazer run

# Start with options
stargazer run --port 3001

# Continue most recent session
stargazer run --continue

# Resume specific session
stargazer run --resume <session-id>
```

## Architecture

```
apps/cli/src/
├── index.ts              # Entry point (Commander)
├── app/
│   ├── app.tsx           # Main application component
│   ├── views/            # Screen components
│   └── hooks/            # App-level hooks
├── commands/
│   ├── run.ts            # TUI command
│   └── serve.ts          # Headless server
├── components/           # Shared UI components
├── features/
│   ├── chat/             # Chat feature
│   ├── review/           # Review feature
│   └── sessions/         # Session management
├── hooks/                # Shared hooks
├── lib/                  # Utilities
├── stores/               # State management
└── types/                # TypeScript types
```

## Commands

### stargazer run

Start the interactive terminal UI.

```bash
stargazer run [options]

Options:
  -p, --port <port>       Server port (default: 3000)
  -H, --hostname <host>   Server hostname (default: localhost)
  -c, --continue          Continue most recent session
  -r, --resume [id]       Resume session (shows picker if no ID)
```

### stargazer serve

Start headless server without TUI.

```bash
stargazer serve [options]

Options:
  -p, --port <port>       Server port (default: 3000)
  -H, --hostname <host>   Server hostname (default: localhost)
```

## Feature Modules

### Review Feature

Located in `features/review/`.

```typescript
// API
import { reviewApi } from "@/features/review";
const response = await reviewApi.stream(staged);

// Hooks
import { useReview } from "@/features/review";
const { state, startReview, reset } = useReview();

// Components
import { ReviewDisplay } from "@/features/review";
<ReviewDisplay state={state} staged={staged} />
```

### Sessions Feature

Located in `features/sessions/`.

```typescript
// API
import { sessionsApi } from "@/features/sessions";
const sessions = await sessionsApi.list();

// Hooks
import { useSessionList, useActiveSession } from "@/features/sessions";
const { sessions, loading, error } = useSessionList();
const { session, setSession } = useActiveSession();
```

### Chat Feature

Located in `features/chat/`.

```typescript
// Hooks
import { useChat } from "@/features/chat";
const { messages, send, streaming } = useChat(sessionId);
```

## Hooks

### useReview

Manages review state and streaming.

```typescript
import { useReview } from "@/features/review";

const { state, startReview, reset } = useReview();

// State types
type ReviewState =
  | { status: "idle" }
  | { status: "loading"; content: string }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };

// Start review
await startReview(true);  // staged changes
await startReview(false); // unstaged changes

// Reset to idle
reset();
```

### useGitStatus

Fetches git repository status.

```typescript
import { useGitStatus } from "@/hooks";

const { status, loading, error, refresh } = useGitStatus();

// status.branch: string
// status.files.staged: string[]
// status.files.unstaged: string[]
```

### useGitDiff

Fetches git diff content.

```typescript
import { useGitDiff } from "@/hooks";

const { diff, loading, error } = useGitDiff({ staged: true });
```

### useConfig

Manages user configuration.

```typescript
import { useConfig } from "@/hooks";

const { config, loading, save, check } = useConfig();

// Check if configured
const { configured } = await check();

// Save configuration
await save({ provider: "gemini", apiKey: "...", model: "gemini-2.5-flash" });
```

### useSSEStream

Low-level SSE stream handling.

```typescript
import { useSSEStream } from "@/hooks";

const { start, abort, state } = useSSEStream<ReviewStreamEvent>({
  url: "/review/stream",
  onEvent: (event) => handleEvent(event),
  onComplete: () => finalize(),
  onError: (error) => handleError(error),
});
```

## Components

### ReviewDisplay

Displays review results with severity-colored output.

```typescript
import { ReviewDisplay } from "@/features/review";

<ReviewDisplay
  state={reviewState}
  staged={true}
/>
```

### Severity Colors

| Severity | Color | Meaning |
|----------|-------|---------|
| critical | Red | Must fix |
| warning | Yellow | Should fix |
| suggestion | Blue | Nice to have |
| nitpick | Gray | Minor style |

## Keyboard Shortcuts

### Main View

| Key | Action |
|-----|--------|
| `r` | Start AI review |
| `s` | Toggle staged/unstaged |
| `h` | View review history |
| `?` | Show help |
| `q` | Quit |

### Review View

| Key | Action |
|-----|--------|
| `j/k` | Navigate issues |
| `Enter` | View issue details |
| `i` | Ignore issue |
| `r` | Refresh review |
| `b` | Back to main |
| `Esc` | Back to main |

## State Management

The CLI uses React hooks for state. Complex state uses Zustand stores:

```typescript
// stores/session-store.ts
import { create } from "zustand";

interface SessionStore {
  currentSession: Session | null;
  setSession: (session: Session) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentSession: null,
  setSession: (session) => set({ currentSession: session }),
}));
```

## Server Lifecycle

The CLI manages server lifecycle:

```typescript
// lib/server.ts
export function createServerManager(options: ServerOptions) {
  return {
    start: async () => { /* Start Hono server */ },
    stop: async () => { /* Graceful shutdown */ },
    address: string, // http://localhost:3000
  };
}
```

### Shutdown Handling

```typescript
// Graceful shutdown on SIGINT/SIGTERM
process.on("SIGINT", async () => {
  await serverManager.stop();
  process.exit(0);
});
```

## Testing

```bash
# Run CLI tests
npx vitest run apps/cli

# Run specific test
npx vitest run apps/cli/src/features/review/hooks/use-review.test.ts
```

## Cross-References

- [Apps: Server](./server.md) - Server API
- [Features: Review Flow](../features/review-flow.md) - Review implementation
- [Reference: CLI Commands](../reference/cli-commands.md) - Command reference
