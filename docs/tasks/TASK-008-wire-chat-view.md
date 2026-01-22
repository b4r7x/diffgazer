# TASK-008: Wire Chat View into app.tsx

## Metadata

- **Priority**: P0 (Critical - enables chat functionality)
- **Agent**: `react-component-architect`
- **Dependencies**: TASK-005, TASK-006, TASK-007, TASK-004
- **Package**: `apps/cli`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 0 (patterns) and study `apps/cli/src/app/app.tsx` for the view state machine pattern.

This task wires together all chat components and creates a new view state for interactive chat.

## Current State

### File: `apps/cli/src/app/app.tsx`

```typescript
type View =
  | "loading"
  | "onboarding"
  | "main"
  | "git-status"
  | "git-diff"
  | "review"
  | "settings"
  | "sessions"
  | "review-history";

// No "chat" view exists
```

## Target State

### 1. Add Chat View Type

```typescript
type View =
  | "loading"
  | "onboarding"
  | "main"
  | "git-status"
  | "git-diff"
  | "review"
  | "chat"           // NEW
  | "settings"
  | "sessions"
  | "review-history";
```

### 2. Create useChat Hook

**New File: `apps/cli/src/features/chat/hooks/use-chat.ts`**

```typescript
import { useState, useCallback } from "react";
import { api } from "@repo/api/client";
import { ChatState } from "../components/chat-display.js";

interface UseChatReturn {
  chatState: ChatState;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  reset: () => void;
}

export function useChat(): UseChatReturn {
  const [chatState, setChatState] = useState<ChatState>({ status: "idle" });

  const sendMessage = useCallback(async (sessionId: string, message: string) => {
    setChatState({ status: "loading", streamContent: "" });

    try {
      const response = await api().stream(`/sessions/${sessionId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message }),
        headers: { "Content-Type": "application/json" },
      });

      const reader = response.body?.getReader();
      if (!reader) {
        setChatState({ status: "error", error: "No response body" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "chunk") {
                fullContent += data.content;
                setChatState({ status: "loading", streamContent: fullContent });
              } else if (data.type === "complete") {
                setChatState({ status: "idle" });
                return;
              } else if (data.type === "error") {
                setChatState({ status: "error", error: data.error.message });
                return;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      setChatState({ status: "idle" });
    } catch (error) {
      setChatState({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setChatState({ status: "idle" });
  }, []);

  return { chatState, sendMessage, reset };
}
```

### 3. Update app.tsx

Add imports:
```typescript
import { ChatDisplay, ChatInput, ChatState } from "./features/chat/index.js";
import { useChat } from "./features/chat/hooks/use-chat.js";
```

Add hook in component:
```typescript
const { chatState, sendMessage, reset: resetChat } = useChat();
```

Add keyboard handler for 'c' to enter chat:
```typescript
// In useInput callback
if (input === "c" && view === "main" && currentSession) {
  setView("chat");
}
```

Add back handler from chat:
```typescript
if ((input === "b" || key.escape) && view === "chat") {
  resetChat();
  setView("main");
}
```

Add chat view rendering:
```typescript
{view === "chat" && currentSession && (
  <Box flexDirection="column" height="100%">
    <ChatDisplay session={currentSession} chatState={chatState} />
    <ChatInput
      onSubmit={(message) => sendMessage(currentSession.metadata.id, message)}
      disabled={chatState.status === "loading"}
    />
    <Box marginTop={1}>
      <Text color="gray">Press ESC or 'b' to go back</Text>
    </Box>
  </Box>
)}
```

Update main menu to show chat option:
```typescript
<Text color="cyan">[c]</Text><Text> Chat</Text>
```

### 4. Update index.ts exports

**File: `apps/cli/src/features/chat/index.ts`**

```typescript
export { ChatDisplay } from "./components/chat-display.js";
export { MessageItem } from "./components/message-item.js";
export { ChatInput } from "./components/chat-input.js";
export { useChat } from "./hooks/use-chat.js";
export type { ChatState } from "./components/chat-display.js";
```

## Files to Create/Modify

1. **Create** `apps/cli/src/features/chat/hooks/use-chat.ts`
   - Chat state management and API integration

2. **Update** `apps/cli/src/features/chat/index.ts`
   - Add useChat export

3. **Update** `apps/cli/src/app/app.tsx`
   - Add "chat" to View type
   - Import chat components and hook
   - Add 'c' keybinding to enter chat
   - Add chat view rendering
   - Add back navigation from chat
   - Update main menu with chat option

## Acceptance Criteria

- [ ] "chat" added to View type
- [ ] `useChat` hook created with sendMessage and chatState
- [ ] Press 'c' from main menu enters chat view (when session exists)
- [ ] Chat view shows ChatDisplay and ChatInput
- [ ] Messages stream correctly when sent
- [ ] Press ESC or 'b' returns to main menu
- [ ] Main menu shows [c] Chat option
- [ ] Input disabled during AI response
- [ ] Session messages update after response completes
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/cli build
pnpm typecheck

# Manual test:
# 1. pnpm dev
# 2. Press 'H' to see sessions
# 3. Select or create a session
# 4. Press 'c' to enter chat
# 5. Type a message and press Enter
# 6. Observe streaming response
# 7. Press ESC to go back
```

## Notes

- The session must exist before entering chat (create via normal flow).
- Reloading the session after each message is needed to see updated messages.
- For now, don't worry about scrolling - basic functionality first.
- The useChat hook follows the same pattern as useReview.
