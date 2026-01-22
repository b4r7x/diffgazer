# TASK-007: Build ChatInput Component

## Metadata

- **Priority**: P1 (Important - user input for chat)
- **Agent**: `react-component-architect`
- **Dependencies**: TASK-006 (MessageItem exists)
- **Package**: `apps/cli`

## Context

Read existing input patterns in the CLI. The ChatInput component provides a text input field for sending messages.

Ink provides `TextInput` from the `ink-text-input` package (or inline with `useInput` hook).

## Current State

After TASK-006, chat components exist but there's no input field for sending messages.

### Check if ink-text-input is installed

Look at `apps/cli/package.json` for existing text input dependencies.

## Target State

### New File: `apps/cli/src/features/chat/components/chat-input.tsx`

```typescript
import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, disabled = false, placeholder = "Type a message..." }: ChatInputProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (disabled) return;

    if (key.return && value.trim()) {
      onSubmit(value.trim());
      setValue("");
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box borderStyle="single" borderColor={disabled ? "gray" : "cyan"} paddingX={1}>
      <Text color={disabled ? "gray" : "white"}>
        {value || <Text color="gray">{placeholder}</Text>}
      </Text>
      {!disabled && <Text color="cyan">_</Text>}
    </Box>
  );
}
```

### Alternative (if `ink-text-input` is available)

```typescript
import { Box } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, disabled = false, placeholder = "Type a message..." }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (submittedValue: string) => {
    if (submittedValue.trim()) {
      onSubmit(submittedValue.trim());
      setValue("");
    }
  };

  return (
    <Box borderStyle="single" borderColor={disabled ? "gray" : "cyan"} paddingX={1}>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        focus={!disabled}
      />
    </Box>
  );
}
```

### Update: `apps/cli/src/features/chat/index.ts`

```typescript
export { ChatDisplay } from "./components/chat-display.js";
export { MessageItem } from "./components/message-item.js";
export { ChatInput } from "./components/chat-input.js";
export type { ChatState } from "./components/chat-display.js";
```

## Files to Create/Modify

1. **Create** `apps/cli/src/features/chat/components/chat-input.tsx`
   - Text input component for chat

2. **Update** `apps/cli/src/features/chat/index.ts`
   - Add ChatInput export

3. **(If needed)** `apps/cli/package.json`
   - Add `ink-text-input` dependency if using that approach

## Acceptance Criteria

- [ ] `ChatInput` component created
- [ ] `onSubmit` callback called with message on Enter
- [ ] Input cleared after submit
- [ ] `disabled` prop prevents input when true
- [ ] Visual feedback shows disabled state (gray border)
- [ ] Shows placeholder when empty
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

- Choose the simpler approach based on existing dependencies.
- If `ink-text-input` is not already a dependency, use the `useInput` approach to avoid adding new deps.
- The border provides visual indication of the input area.
- Keep it simple - no multi-line input, no history, just basic text entry.
