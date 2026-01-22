# TASK-006: Build MessageItem Component

## Metadata

- **Priority**: P1 (Important - part of chat UI)
- **Agent**: `react-component-architect`
- **Dependencies**: TASK-005 (ChatDisplay exists)
- **Package**: `apps/cli`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 3 (Sessions - SessionMessage schema).

The MessageItem component renders a single chat message with role-based styling. It's used by ChatDisplay to render the conversation.

## Current State

After TASK-005, the chat folder structure exists but MessageItem is a placeholder or missing.

### Session Message Schema (from `packages/schemas/src/session.ts`)

```typescript
SessionMessage = {
  id: string (UUID)
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string (ISO)
}
```

## Target State

### New File: `apps/cli/src/features/chat/components/message-item.tsx`

```typescript
import { Box, Text } from "ink";
import { SessionMessage } from "@repo/schemas/session";

interface MessageItemProps {
  message: SessionMessage;
}

const ROLE_COLORS = {
  user: "yellow",
  assistant: "green",
  system: "gray",
} as const;

const ROLE_LABELS = {
  user: "YOU",
  assistant: "ASSISTANT",
  system: "SYSTEM",
} as const;

export function MessageItem({ message }: MessageItemProps) {
  const color = ROLE_COLORS[message.role];
  const label = ROLE_LABELS[message.role];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color} bold>
          {label}:
        </Text>
      </Box>
      <Box marginLeft={2} marginBottom={1}>
        <Text wrap="wrap">{message.content}</Text>
      </Box>
    </Box>
  );
}
```

### Update: `apps/cli/src/features/chat/index.ts`

```typescript
export { ChatDisplay } from "./components/chat-display.js";
export { MessageItem } from "./components/message-item.js";
export type { ChatState } from "./components/chat-display.js";
```

## Files to Create/Modify

1. **Create** `apps/cli/src/features/chat/components/message-item.tsx`
   - Individual message component

2. **Update** `apps/cli/src/features/chat/index.ts`
   - Add MessageItem export

## Acceptance Criteria

- [ ] `MessageItem` component created
- [ ] Different colors for user (yellow), assistant (green), system (gray)
- [ ] Role label shown in bold (YOU, ASSISTANT, SYSTEM)
- [ ] Content wrapped properly with `wrap="wrap"`
- [ ] Proper spacing between label and content
- [ ] Exported from `features/chat/index.ts`
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/cli build
pnpm typecheck
```

## Notes

- Keep the component simple - just role, label, and content.
- Don't add timestamps in the UI yet - focus on core functionality.
- Use semantic colors that work in most terminal themes.
- The `wrap="wrap"` is important for long messages in terminal.
