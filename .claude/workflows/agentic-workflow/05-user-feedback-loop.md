# Phase 5: User Feedback Loop

## Overview

Enable users to interact with the review process - focus on specific areas, ignore noise, ask questions. This is the "controllable agent" aspect.

## Goal

User can:
- `/focus security` - Filter to security issues
- `/ignore style` - Hide style/nit issues
- `/ask why is this bad?` - Ask about selected issue
- `/refine` - Re-analyze current issue with more context

---

## Agent 5.1: Feedback Command Schema

```
subagent_type: "backend-development:backend-architect"

Task: Define feedback command types.

Location: packages/schemas/src/feedback.ts

## Types

import { z } from "zod";

// Focus command - filter issues
const FocusCommandSchema = z.object({
  type: z.literal("focus"),
  filter: z.string(), // "security", "high", "auth.ts", etc.
});

// Ignore command - hide matching issues
const IgnoreCommandSchema = z.object({
  type: z.literal("ignore"),
  pattern: z.string(), // "style", "nit", "low", etc.
});

// Refine command - deep analysis on issue
const RefineCommandSchema = z.object({
  type: z.literal("refine"),
  issueId: z.string(),
});

// Ask command - question about issue
const AskCommandSchema = z.object({
  type: z.literal("ask"),
  question: z.string(),
  issueId: z.string().optional(), // Context issue
});

// Stop command - cancel running analysis
const StopCommandSchema = z.object({
  type: z.literal("stop"),
});

// Union type
const FeedbackCommandSchema = z.discriminatedUnion("type", [
  FocusCommandSchema,
  IgnoreCommandSchema,
  RefineCommandSchema,
  AskCommandSchema,
  StopCommandSchema,
]);

type FeedbackCommand = z.infer<typeof FeedbackCommandSchema>;

## Command Parsing Helper

function parseCommand(input: string): FeedbackCommand | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.startsWith("focus ")) {
    return { type: "focus", filter: trimmed.slice(6).trim() };
  }
  if (trimmed.startsWith("ignore ")) {
    return { type: "ignore", pattern: trimmed.slice(7).trim() };
  }
  if (trimmed === "refine") {
    return { type: "refine", issueId: "" }; // Needs context
  }
  if (trimmed.startsWith("ask ")) {
    return { type: "ask", question: trimmed.slice(4).trim() };
  }
  if (trimmed === "stop") {
    return { type: "stop" };
  }

  return null; // Unknown command
}

## Export

Export from packages/schemas/src/index.ts:
- FeedbackCommandSchema
- FeedbackCommand type
- parseCommand helper

## Steps

1. Create packages/schemas/src/feedback.ts
2. Define all command schemas
3. Create parseCommand helper
4. Export from index.ts
5. Run: npm run type-check

Output: Feedback schema created
```

---

## Agent 5.2: Feedback Command Input Component

```
subagent_type: "react-component-architect"

Task: Create command input for feedback during review.

Location: apps/cli/src/features/review/components/feedback-input.tsx

## Component Interface

interface FeedbackInputProps {
  isVisible: boolean;
  onCommand: (cmd: FeedbackCommand) => void;
  onCancel: () => void;
  selectedIssueId?: string; // For context
}

## Layout

When visible, show input at bottom of screen:

┌─────────────────────────────────────────────────────────────┐
│ > focus security_                                           │
│   focus <topic> | ignore <pattern> | ask <question> | stop  │
└─────────────────────────────────────────────────────────────┘

## Implementation

import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";
import { parseCommand, FeedbackCommand } from "@repo/schemas";

export function FeedbackInput({
  isVisible,
  onCommand,
  onCancel,
  selectedIssueId,
}: FeedbackInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isVisible) return null;

  const handleSubmit = (input: string) => {
    if (!input.trim()) {
      onCancel();
      return;
    }

    const cmd = parseCommand(input);
    if (!cmd) {
      setError(`Unknown command: ${input}`);
      return;
    }

    // Add issue context for refine/ask
    if (cmd.type === "refine" && selectedIssueId) {
      cmd.issueId = selectedIssueId;
    }
    if (cmd.type === "ask" && selectedIssueId && !cmd.issueId) {
      cmd.issueId = selectedIssueId;
    }

    setValue("");
    setError(null);
    onCommand(cmd);
  };

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Box>
        <Text color="cyan">&gt; </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
        />
      </Box>
      {error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Text color="gray">
          focus &lt;topic&gt; | ignore &lt;pattern&gt; | ask &lt;question&gt; | stop
        </Text>
      )}
    </Box>
  );
}

## Keyboard Trigger

In parent component, show input when user presses `/` or `:`:

const [showFeedback, setShowFeedback] = useState(false);

useInput((input, key) => {
  if (input === "/" || input === ":") {
    setShowFeedback(true);
  }
  if (key.escape && showFeedback) {
    setShowFeedback(false);
  }
});

## Steps

1. Create apps/cli/src/features/review/components/feedback-input.tsx
2. Implement input component with TextInput
3. Parse and validate commands
4. Handle empty input as cancel
5. Export from index.ts
6. Run: npm run type-check

Output: Feedback input created
```

---

## Agent 5.3: Apply Feedback to Review

```
subagent_type: "react-component-architect"

Task: Handle feedback commands in review flow.

Modify: apps/cli/src/app/views/review-view.tsx

## State Additions

const [showFeedback, setShowFeedback] = useState(false);
const [activeFilter, setActiveFilter] = useState<string | null>(null);
const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
const [askResponse, setAskResponse] = useState<string | null>(null);

## Filter Issues

const filteredIssues = useMemo(() => {
  let result = issues;

  // Apply focus filter
  if (activeFilter) {
    const filter = activeFilter.toLowerCase();
    result = result.filter((issue) =>
      issue.category.toLowerCase().includes(filter) ||
      issue.severity.toLowerCase().includes(filter) ||
      issue.file.toLowerCase().includes(filter) ||
      issue.title.toLowerCase().includes(filter)
    );
  }

  // Apply ignore patterns
  for (const pattern of ignorePatterns) {
    const pat = pattern.toLowerCase();
    result = result.filter((issue) =>
      !issue.category.toLowerCase().includes(pat) &&
      !issue.severity.toLowerCase().includes(pat) &&
      !issue.title.toLowerCase().includes(pat)
    );
  }

  return result;
}, [issues, activeFilter, ignorePatterns]);

## Command Handlers

const handleCommand = async (cmd: FeedbackCommand) => {
  setShowFeedback(false);

  switch (cmd.type) {
    case "focus":
      setActiveFilter(cmd.filter);
      break;

    case "ignore":
      setIgnorePatterns((prev) => [...prev, cmd.pattern]);
      break;

    case "refine":
      if (cmd.issueId) {
        // Trigger drilldown
        await triggerDrilldown(cmd.issueId);
      }
      break;

    case "ask":
      if (cmd.question) {
        // Send to AI, show response
        const response = await askAboutIssue(cmd.question, cmd.issueId);
        setAskResponse(response);
      }
      break;

    case "stop":
      // Cancel running analysis (if applicable)
      abortController?.abort();
      break;
  }
};

## Ask API Call

async function askAboutIssue(
  question: string,
  issueId?: string
): Promise<string> {
  const issue = issueId ? issues.find((i) => i.id === issueId) : null;

  const response = await apiClient.post("/chat/ask", {
    question,
    context: issue ? {
      title: issue.title,
      file: issue.file,
      rationale: issue.rationale,
      recommendation: issue.recommendation,
    } : undefined,
  });

  return response.answer;
}

## Display Ask Response

{askResponse && (
  <Box flexDirection="column" borderStyle="single" paddingX={1}>
    <Text color="cyan">🤖 Answer:</Text>
    <Text>{askResponse}</Text>
    <Text color="gray">Press Esc to dismiss</Text>
  </Box>
)}

## Steps

1. Add state for filter, ignorePatterns, askResponse
2. Implement filteredIssues with useMemo
3. Implement command handlers
4. Add ask API call
5. Display filter indicator and ask response
6. Run: npm run type-check

Output: Feedback commands working
```

---

## Agent 5.4: Update Footer with Feedback Shortcuts

```
subagent_type: "react-component-architect"

Task: Update footer to show feedback shortcuts.

Modify: apps/cli/src/components/ui/footer-bar.tsx

## Add Feedback Shortcuts

Key mode footer should show:

"j/k move  e explain  / command  f focus  ? help"

When filter is active, show indicator:

"j/k move  e explain  / command  [security] ×clear  ? help"

## Implementation

interface FooterBarProps {
  shortcuts: ShortcutDef[];
  activeFilter?: string | null;
  onClearFilter?: () => void;
}

function FooterBar({ shortcuts, activeFilter, onClearFilter }: FooterBarProps) {
  return (
    <Box borderStyle="single" borderTop paddingX={1}>
      {/* Filter indicator */}
      {activeFilter && (
        <Text>
          <Text color="yellow">[{activeFilter}]</Text>
          <Text color="gray"> ×clear  </Text>
        </Text>
      )}

      {/* Shortcuts */}
      {shortcuts.map((s, i) => (
        <Text key={i}>
          <Text color="cyan">{s.key}</Text>
          <Text> {s.label}  </Text>
        </Text>
      ))}
    </Box>
  );
}

## Shortcut Definitions

const keyModeShortcuts: ShortcutDef[] = [
  { key: "j/k", label: "move" },
  { key: "e", label: "explain" },
  { key: "/", label: "command" },
  { key: "f", label: "focus" },
  { key: "?", label: "help" },
];

## Steps

1. Add activeFilter and onClearFilter props
2. Show filter indicator when active
3. Add "/" shortcut to list
4. Update consumers to pass new props
5. Run: npm run type-check

Output: Footer updated with feedback shortcuts
```

---

## Agent 5.5: Chat/Ask Endpoint

```
subagent_type: "backend-development:backend-architect"

Task: Create endpoint for ask command.

Location: apps/server/src/api/routes/chat.ts

## Endpoint

POST /chat/ask
Body: {
  question: string;
  context?: {
    title?: string;
    file?: string;
    rationale?: string;
    recommendation?: string;
  };
}

Response: {
  answer: string;
}

## Implementation

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const AskRequestSchema = z.object({
  question: z.string().min(1),
  context: z.object({
    title: z.string().optional(),
    file: z.string().optional(),
    rationale: z.string().optional(),
    recommendation: z.string().optional(),
  }).optional(),
});

export const chatRoutes = new Hono()
  .post("/ask", zValidator("json", AskRequestSchema), async (c) => {
    const { question, context } = c.req.valid("json");

    const prompt = buildAskPrompt(question, context);
    const result = await aiClient.generate(prompt, AnswerSchema);

    if (!result.ok) {
      return c.json({ error: result.error.message }, 500);
    }

    return c.json({ answer: result.value.answer });
  });

function buildAskPrompt(
  question: string,
  context?: { title?: string; file?: string; rationale?: string }
): string {
  let prompt = `User question: ${escapeXml(question)}\n\n`;

  if (context) {
    prompt += "Context (code review issue):\n";
    if (context.title) prompt += `Title: ${escapeXml(context.title)}\n`;
    if (context.file) prompt += `File: ${escapeXml(context.file)}\n`;
    if (context.rationale) prompt += `Issue: ${escapeXml(context.rationale)}\n`;
  }

  prompt += "\nProvide a concise, helpful answer.";
  return prompt;
}

## Steps

1. Create or update apps/server/src/api/routes/chat.ts
2. Implement /ask endpoint
3. Build prompt with escaped context
4. Mount route in app.ts
5. Run: npm run type-check

Output: Ask endpoint created
```

---

## Why This Design

### Simple Command Syntax

Commands like `focus security` instead of `--filter=security` because:
- More natural language
- Faster to type
- Easier to remember
- Feels more "chat-like"

### Client-Side Filtering

Filter and ignore are applied client-side because:
- Instant response (no API call)
- Issues already loaded
- Can easily clear/change filter
- Server doesn't need to re-analyze

### Ask Uses AI

The ask command sends to AI because:
- Questions are open-ended
- Need reasoning, not just data lookup
- Can explain "why" not just "what"
- Feels like asking the agent
