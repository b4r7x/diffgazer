# TASK-004: Create Chat Streaming Endpoint

## Metadata

- **Priority**: P0 (Critical - needed for chat)
- **Agent**: `backend-developer`
- **Dependencies**: None (can start in parallel with TASK-001-003)
- **Package**: `apps/server`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 3 (Sessions) and review the existing streaming pattern in `/apps/server/src/api/routes/review.ts`.

The chat endpoint allows users to send messages and receive AI responses via SSE streaming. Follow the same pattern as the review streaming endpoint.

## Current State

No chat endpoint exists. The session routes (`/sessions`) only handle CRUD, not AI chat.

### Existing Pattern (from `apps/server/src/api/routes/review.ts`)

```typescript
import { streamSSE } from "hono/streaming";

review.get("/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    // ... stream AI response
    await stream.writeSSE({ event: "chunk", data: JSON.stringify({ type: "chunk", content: chunk }) });
    await stream.writeSSE({ event: "complete", data: JSON.stringify({ type: "complete", result }) });
  });
});
```

## Target State

### New File: `apps/server/src/api/routes/chat.ts`

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { zodErrorHandler } from "../../lib/response.js";
import { getConfig } from "@repo/core/storage/config";
import { getApiKey } from "@repo/core/secrets/vault";
import { createAIClient } from "@repo/core/ai/client";
import { addMessage, sessionStore } from "@repo/core/storage/sessions";

const ChatRequestSchema = z.object({
  message: z.string().min(1),
});

export const chat = new Hono();

// POST /sessions/:id/chat - Send message and get AI response via SSE
chat.post(
  "/:id/chat",
  zValidator("json", ChatRequestSchema, zodErrorHandler),
  async (c) => {
    const sessionId = c.req.param("id");
    const { message } = c.req.valid("json");

    // Load session
    const sessionResult = await sessionStore.read(sessionId);
    if (!sessionResult.ok) {
      return c.json({ success: false, error: { message: "Session not found", code: "NOT_FOUND" } }, 404);
    }
    const session = sessionResult.value;

    // Add user message
    const userMsgResult = await addMessage(sessionId, "user", message);
    if (!userMsgResult.ok) {
      return c.json({ success: false, error: { message: "Failed to save message", code: "INTERNAL_ERROR" } }, 500);
    }

    // Get AI client
    const configResult = await getConfig();
    if (!configResult.ok) {
      return c.json({ success: false, error: { message: "Config not found", code: "CONFIG_ERROR" } }, 500);
    }
    const config = configResult.value;

    const apiKeyResult = await getApiKey(config.provider);
    if (!apiKeyResult.ok) {
      return c.json({ success: false, error: { message: "API key not found", code: "API_KEY_MISSING" } }, 500);
    }

    const clientResult = createAIClient(config.provider, {
      apiKey: apiKeyResult.value,
      model: config.model,
    });
    if (!clientResult.ok) {
      return c.json({ success: false, error: { message: "Failed to create AI client", code: "AI_ERROR" } }, 500);
    }
    const client = clientResult.value;

    // Build conversation prompt
    const conversationHistory = session.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const prompt = `You are a helpful AI assistant for code review and development discussions.

Previous conversation:
${conversationHistory}

USER: ${message}

Respond helpfully and concisely.`;

    // Stream response
    return streamSSE(c, async (stream) => {
      let fullContent = "";

      try {
        await client.generateStream(prompt, {
          onChunk: async (chunk) => {
            fullContent += chunk;
            await stream.writeSSE({
              event: "chunk",
              data: JSON.stringify({ type: "chunk", content: chunk }),
            });
          },
          onComplete: async () => {
            // Save assistant message
            await addMessage(sessionId, "assistant", fullContent);
            await stream.writeSSE({
              event: "complete",
              data: JSON.stringify({ type: "complete", content: fullContent }),
            });
          },
          onError: async (error) => {
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify({ type: "error", error: { message: error.message, code: "AI_ERROR" } }),
            });
          },
        });
      } catch (error) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            error: { message: error instanceof Error ? error.message : "Unknown error", code: "STREAM_ERROR" }
          }),
        });
      }
    });
  }
);
```

### Update: `apps/server/src/app.ts`

Add the chat routes to the app:

```typescript
import { chat } from "./api/routes/chat.js";

// Add after sessions routes
app.route("/sessions", chat);  // This makes it /sessions/:id/chat
```

## Files to Modify

1. **Create** `apps/server/src/api/routes/chat.ts`
   - New endpoint for chat streaming

2. `apps/server/src/app.ts`
   - Import and mount chat routes

## Acceptance Criteria

- [ ] `POST /sessions/:id/chat` endpoint created
- [ ] Accepts `{ message: string }` in request body
- [ ] Streams AI response via SSE (chunk, complete, error events)
- [ ] Saves user message before streaming
- [ ] Saves assistant message after streaming completes
- [ ] Returns 404 if session not found
- [ ] Follows existing review streaming pattern
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/server build
pnpm typecheck

# Manual test (after server running):
# 1. Create a session via POST /sessions
# 2. Send chat via POST /sessions/{id}/chat with {"message": "Hello"}
# 3. Observe SSE stream
```

## Notes

- Mount on `/sessions/:id/chat` to keep session-related routes together.
- The prompt is simple for now - it will be enhanced with review context in later tasks.
- Error handling follows the existing pattern (JSON error response for setup errors, SSE error for stream errors).
- The conversation history includes ALL messages (user + assistant) for context.
