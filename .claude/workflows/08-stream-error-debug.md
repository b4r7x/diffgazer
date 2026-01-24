# Stream Error Debug Workflow

## Problem

AI review (both staged and unstaged) shows:
```
Error: Stream ended unexpectedly
```

The SSE stream from server to CLI terminates prematurely.

---

## Project Context

**Stack:** Hono server with SSE streaming → CLI (React Ink) consuming stream

**Key files:**
- Server: `apps/server/src/api/routes/triage.ts` - SSE endpoint
- Server: `apps/server/src/services/triage-service.ts` - triage logic
- CLI: `apps/cli/src/features/review/hooks/use-triage.ts` - stream consumer
- CLI: `apps/cli/src/features/review/api/triage-api.ts` - API call
- Core: `packages/core/src/ai/sdk-client.ts` - AI SDK calls
- Core: `packages/core/src/review/triage.ts` - review engine

---

## Debug Steps

### Step 1: Check Server Logs
Run the CLI and check if server logs show errors:
```bash
# In one terminal, start with verbose logging
cd /Users/voitz/Projects/stargazer
DEBUG=* npm run dev

# In another terminal, trigger review
stargazer review --unstaged
```

### Step 2: Check AI Provider Configuration
The stream might fail if:
- No API key configured
- Wrong provider selected
- API key invalid

Check:
- `~/.stargazer/config.json` for provider settings
- Keyring or `~/.stargazer/secrets/secrets.json` for API keys

### Step 3: Trace the Stream Flow

**Server side (apps/server/src/api/routes/triage.ts):**
1. Receives request at GET /triage/stream
2. Gets diff from git
3. Calls triage service
4. Streams SSE events back

**Possible failure points:**
- Git diff command fails
- AI client creation fails (no API key)
- AI SDK generateObject/streamText throws
- SSE write fails

---

## Execution

### Agent 1: Server-Side Debug
```
subagent_type: "backend-development:backend-architect"

Task: Debug the SSE streaming error in triage route.

Read these files:
1. apps/server/src/api/routes/triage.ts
2. apps/server/src/services/triage-service.ts (if exists)
3. packages/core/src/ai/sdk-client.ts
4. packages/core/src/review/triage.ts

Check for:
1. Is the SSE stream properly set up with correct headers?
2. Are errors caught and sent as SSE error events?
3. Does the AI client handle missing API keys gracefully?
4. Is there a try-catch around the main triage logic?
5. Does the stream close properly with a "complete" event?

Common SSE issues:
- Missing "Content-Type: text/event-stream" header
- Missing "Connection: keep-alive" header
- Uncaught exceptions killing the stream
- Stream not flushed before close

Fix any issues found. Add proper error handling if missing.
```

### Agent 2: CLI-Side Debug
```
subagent_type: "react-component-architect"

Task: Debug the stream consumption in CLI.

Read these files:
1. apps/cli/src/features/review/hooks/use-triage.ts
2. apps/cli/src/features/review/api/triage-api.ts

Check for:
1. How is EventSource or fetch stream consumed?
2. Is "Stream ended unexpectedly" a custom error message? Find where it's thrown.
3. What triggers this error - connection close, parse error, timeout?
4. Is there proper error event handling?

Search for the exact error message:
grep -r "Stream ended unexpectedly" apps/cli/

Fix the root cause or improve error message to show actual reason.
```

### Agent 3: Integration Test
```
subagent_type: "backend-development:backend-architect"

Task: Create a minimal test to verify streaming works.

1. Check if there's a test for the triage stream endpoint
2. If not, create one in apps/server/src/api/routes/triage.test.ts
3. Test should:
   - Mock the AI client
   - Call GET /triage/stream
   - Verify SSE events are received
   - Verify stream completes with "complete" event

Also manually test:
1. Check if API key is configured:
   - Read ~/.stargazer/config.json
   - Check which provider is selected
2. Try calling the AI directly to see if it works:
   - Create a simple test script that calls generateObject
```

---

## Quick Manual Debug

Run these commands to gather info:

```bash
# Check if config exists
cat ~/.stargazer/config.json

# Check if secrets exist (API keys)
cat ~/.stargazer/secrets/secrets.json 2>/dev/null || echo "No secrets file"

# Check server logs - run in project root
npm run dev 2>&1 | tee server.log

# In another terminal, trigger review and watch logs
stargazer review --unstaged
```

---

## Likely Causes

| Cause | Symptom | Fix |
|-------|---------|-----|
| No API key | Stream starts then immediately errors | Add API key via CLI or config |
| AI SDK error | Error in server logs | Check API key validity, model name |
| SSE headers wrong | Browser works, CLI fails | Fix Content-Type header |
| Uncaught exception | No error event sent | Add try-catch, send error event |
| Stream not awaited | Completes before data sent | Await the streaming properly |
| Git diff fails | No diff to review | Check git status, ensure changes exist |

---

## Expected Fix

After debugging, the stream should:
1. Send "start" event
2. Send multiple "issue" events (or "chunk" for progress)
3. Send "complete" event with reviewId
4. OR send "error" event with message if something fails

The CLI should display the actual error message, not generic "Stream ended unexpectedly".
