# Phase 1: Streaming Integration

## Overview

Wire the streaming triage function to the server SSE endpoint, enabling real-time agent events.

**Priority:** CRITICAL
**Dependencies:** None (first phase)

---

## Context

### Current State
- `triageReviewStream()` exists in `packages/core/src/review/triage.ts`
- Server has SSE endpoint at `/triage/stream`
- SSE emits basic events (lens_start, lens_complete) but NOT agent events

### Problem
Server calls `triageReview()` in a loop per lens, missing all agent events:
- agent_start
- agent_thinking
- tool_call
- tool_result
- issue_found
- agent_complete
- orchestrator_complete

### Goal
Replace loop with single `triageReviewStream()` call that emits all events.

---

## Agent 1.1: Analyze Current Implementation

```
subagent_type: "Explore"

Task: Understand current triage service implementation.

Read these files:
1. apps/server/src/services/triage.ts - Current SSE streaming logic
2. packages/core/src/review/triage.ts - Find triageReviewStream signature
3. packages/schemas/src/agent-event.ts - Event types

Answer:
1. What is the exact signature of triageReviewStream?
2. How does the server currently call triage?
3. What events does triageReviewStream emit?
4. How does writeSSE work?

Output: Analysis of current state
```

---

## Agent 1.2: Update Triage Service

```
subagent_type: "backend-development:backend-architect"

Task: Update server triage service to use triageReviewStream.

Read first:
- apps/server/src/services/triage.ts

Modify: apps/server/src/services/triage.ts

CRITICAL CHANGES:

1. Add import for AgentStreamEvent:
```typescript
import type { AgentStreamEvent } from '@repo/schemas';
import { triageReviewStream } from '@repo/core/review';
```

2. Find the function that handles streaming (likely `streamTriageToSSE` or similar).

3. Replace the for-loop over lenses with:
```typescript
export async function streamTriageToSSE(
  writer: WritableStreamDefaultWriter,
  client: AIClient,
  diff: string,
  options: {
    lenses?: string[];
    profile?: string;
    files?: string[];
  }
): Promise<void> {
  const { lenses, profile, files } = options;

  // Validate diff size
  if (diff.length > MAX_DIFF_SIZE) {
    writeSSEError(writer, 'DIFF_TOO_LARGE', 'Diff exceeds maximum size');
    return;
  }

  // Resolve lenses from profile if needed
  const selectedLenses = lenses ?? getProfileLenses(profile) ?? DEFAULT_LENSES;

  // Stream start event
  writeSSE(writer, 'stream_start', {
    lenses: selectedLenses,
    timestamp: new Date().toISOString(),
  });

  // Run streaming triage with event forwarding
  const result = await triageReviewStream(client, diff, {
    lenses: selectedLenses,
    files,
    onEvent: (event: AgentStreamEvent) => {
      // Forward agent event directly to SSE
      // Use event.type as the SSE event name
      writeSSE(writer, event.type, event);
    },
  });

  // Handle result
  if (result.ok) {
    const { summary, issues } = result.value;

    // Save to storage
    const reviewId = await saveTriageReview({
      diff,
      result: result.value,
      lenses: selectedLenses,
      profile,
    });

    // Send complete event
    writeSSE(writer, 'complete', {
      type: 'complete',
      result: result.value,
      reviewId,
      timestamp: new Date().toISOString(),
    });
  } else {
    writeSSEError(writer, result.error.code, result.error.message);
  }

  // Close stream
  await writer.close();
}
```

4. Remove the old for-loop that calls triageReview per lens.

5. Ensure writeSSE handles all event types:
```typescript
function writeSSE(
  writer: WritableStreamDefaultWriter,
  eventType: string,
  data: unknown
): void {
  const encoder = new TextEncoder();
  const eventString = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  writer.write(encoder.encode(eventString));
}
```

Steps:
1. Backup current implementation (copy to comment or separate file)
2. Update imports
3. Replace loop with triageReviewStream call
4. Wire onEvent callback to writeSSE
5. Verify error handling preserved
6. Run: npm run type-check

Output: Triage service uses streaming
```

---

## Agent 1.3: Update SSE Route

```
subagent_type: "backend-development:backend-architect"

Task: Ensure SSE route properly sets up streaming response.

Read first:
- apps/server/src/api/routes/triage.ts

Verify/Modify: apps/server/src/api/routes/triage.ts

The route should:

1. Set correct headers for SSE:
```typescript
triageRouter.post('/stream', async (c) => {
  // Validate request body
  const body = await c.req.json();
  const { diff, lenses, profile, files } = body;

  if (!diff) {
    return c.json({ error: 'Diff is required' }, 400);
  }

  // Get AI client
  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    return c.json({ error: 'AI client not configured' }, 500);
  }

  // Create SSE stream
  return c.streamText(async (stream) => {
    // Create writer wrapper
    const writer = {
      write: (data: string) => stream.write(data),
      close: () => stream.close(),
    };

    // Run streaming triage
    await streamTriageToSSE(
      writer,
      clientResult.value,
      diff,
      { lenses, profile, files }
    );
  }, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
```

2. If using Hono's stream helper:
```typescript
import { stream } from 'hono/streaming';

triageRouter.post('/stream', async (c) => {
  // ... validation ...

  return stream(c, async (stream) => {
    await streamTriageToSSE(stream, client, diff, options);
  });
});
```

Steps:
1. Read current route implementation
2. Verify SSE headers are set
3. Verify stream is properly created
4. Test with curl

Output: SSE route streams correctly
```

---

## Agent 1.4: Test Streaming

```
subagent_type: "backend-development:backend-architect"

Task: Create test script to verify streaming works.

Create: scripts/test-streaming.sh

```bash
#!/bin/bash

# Test SSE streaming endpoint
echo "Testing SSE streaming..."

# Create test diff with security issue
DIFF=$(cat << 'EOF'
diff --git a/auth.ts b/auth.ts
new file mode 100644
--- /dev/null
+++ b/auth.ts
@@ -0,0 +1,5 @@
+function login(user: string, pass: string) {
+  const query = `SELECT * FROM users WHERE user='${user}'`;
+  return db.query(query);
+}
EOF
)

# Escape for JSON
DIFF_JSON=$(echo "$DIFF" | jq -Rs .)

# Start server if not running
if ! curl -s http://localhost:7860/health > /dev/null 2>&1; then
  echo "Starting server..."
  npm run -w apps/server start &
  sleep 3
fi

# Stream request
echo "Sending stream request..."
curl -N -X POST http://localhost:7860/triage/stream \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d "{\"diff\": $DIFF_JSON, \"lenses\": [\"security\"]}" \
  --max-time 60

echo ""
echo "Done!"
```

Expected output should show events like:
```
event: stream_start
data: {"lenses":["security"],"timestamp":"..."}

event: agent_start
data: {"type":"agent_start","agent":{"id":"guardian","name":"Guardian"...},"timestamp":"..."}

event: agent_thinking
data: {"type":"agent_thinking","agent":"guardian","thought":"Analyzing code for security vulnerabilities...","timestamp":"..."}

event: issue_found
data: {"type":"issue_found","agent":"guardian","issue":{...},"timestamp":"..."}

event: agent_complete
data: {"type":"agent_complete","agent":"guardian","issueCount":1,"timestamp":"..."}

event: complete
data: {"type":"complete","result":{...},"reviewId":"...","timestamp":"..."}
```

Steps:
1. Create test script
2. Make executable: chmod +x scripts/test-streaming.sh
3. Run test
4. Verify events appear correctly

Output: Streaming test script
```

---

## Validation Checklist

- [ ] `triageReviewStream` imported in triage service
- [ ] For-loop replaced with single streaming call
- [ ] `onEvent` callback forwards to `writeSSE`
- [ ] SSE route sets correct Content-Type header
- [ ] Events include: agent_start, agent_thinking, tool_call, tool_result, issue_found, agent_complete
- [ ] Complete event includes result and reviewId
- [ ] Error events properly formatted
- [ ] Test script shows events streaming
- [ ] Type check passes: npm run type-check

---

## Troubleshooting

### No events appearing
1. Check server console for errors
2. Verify `triageReviewStream` is being called
3. Check if onEvent callback is wired correctly

### Events not streaming (all at once)
1. Verify SSE headers set before any writes
2. Check if response is being buffered
3. Try adding `X-Accel-Buffering: no` header

### Type errors
1. Ensure AgentStreamEvent imported from @repo/schemas
2. Check triageReviewStream signature matches
3. Verify onEvent callback type matches
