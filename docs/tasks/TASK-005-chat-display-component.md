# TASK-005: Build ChatDisplay Component

## Metadata

- **Priority**: P1 (Important - core chat UI)
- **Agent**: `react-component-architect`
- **Dependencies**: TASK-004 (chat endpoint exists)
- **Package**: `apps/cli`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 0 (patterns) and look at existing components in `apps/cli/src/features/review/components/` for patterns.

The ChatDisplay component shows the chat conversation (messages + AI streaming response) in the terminal UI using React/Ink.

## Current State

No chat components exist. The feature folder structure needs to be created:

```
apps/cli/src/features/chat/  # Does not exist yet
```

### Existing Pattern (from `apps/cli/src/features/review/components/review-display.tsx`)

```typescript
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface ReviewDisplayProps {
  state: ReviewState;
  // ...
}

export function ReviewDisplay({ state }: ReviewDisplayProps) {
  if (state.status === "loading") {
    return (
      <Box>
        <Text color="cyan"><Spinner type="dots" /></Text>
        <Text> Reviewing...</Text>
      </Box>
    );
  }
  // ... handle other states
}
```

## Target State

### New Directory Structure

```
apps/cli/src/features/chat/
├── components/
│   ├── chat-display.tsx     # Main chat container
│   ├── message-item.tsx     # Individual message (TASK-006)
│   └── chat-input.tsx       # Input field (TASK-007)
├── hooks/
│   └── use-chat.ts          # Chat state management
└── index.ts                 # Exports
```

### New File: `apps/cli/src/features/chat/components/chat-display.tsx`

```typescript
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { Session } from "@repo/schemas/session";
import { MessageItem } from "./message-item.js";

export type ChatState =
  | { status: "idle" }
  | { status: "loading"; streamContent: string }
  | { status: "error"; error: string };

interface ChatDisplayProps {
  session: Session;
  chatState: ChatState;
}

export function ChatDisplay({ session, chatState }: ChatDisplayProps) {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Chat: {session.metadata.title || "Untitled Session"}
        </Text>
        <Text color="gray"> ({session.metadata.messageCount} messages)</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" gap={1}>
        {session.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Streaming response */}
        {chatState.status === "loading" && (
          <Box flexDirection="column">
            <Box>
              <Text color="green" bold>ASSISTANT: </Text>
              <Text color="cyan"><Spinner type="dots" /></Text>
            </Box>
            {chatState.streamContent && (
              <Box marginLeft={2}>
                <Text>{chatState.streamContent}</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Error */}
        {chatState.status === "error" && (
          <Box>
            <Text color="red">Error: {chatState.error}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

### New File: `apps/cli/src/features/chat/index.ts`

```typescript
export { ChatDisplay } from "./components/chat-display.js";
export type { ChatState } from "./components/chat-display.js";
```

## Files to Create

1. `apps/cli/src/features/chat/components/chat-display.tsx`
   - Main chat display component

2. `apps/cli/src/features/chat/index.ts`
   - Public exports

## Acceptance Criteria

- [ ] `ChatDisplay` component created in correct location
- [ ] Shows session title and message count in header
- [ ] Renders all messages from session (will use MessageItem from TASK-006)
- [ ] Shows streaming content with spinner during loading
- [ ] Shows error message when chatState is error
- [ ] Uses Ink components (Box, Text, Spinner)
- [ ] Exports are available from `features/chat/index.ts`
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/cli build
pnpm typecheck
```

## Notes

- MessageItem component will be created in TASK-006 - for now it can be a simple placeholder.
- ChatInput will be created in TASK-007.
- The ChatState type matches the pattern used in ReviewState.
- Keep styling minimal - functionality first, polish later.
