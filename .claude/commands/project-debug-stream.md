Debug the "Stream ended unexpectedly" error in Stargazer AI review.

$ARGUMENTS

## Problem

SSE stream from server to CLI terminates prematurely during triage review.

## Debug Steps

### Step 1: Find Error Source

Search for the error:
```bash
grep -r "Stream ended unexpectedly" apps/
grep -r "ended unexpectedly" apps/
```

### Step 2: Trace Streaming Flow

Read these files:
1. apps/server/src/api/routes/triage.ts (SSE endpoint)
2. apps/cli/src/features/review/hooks/use-triage.ts (stream consumer)
3. apps/cli/src/features/review/api/triage-api.ts (API call)
4. packages/core/src/ai/sdk-client.ts (AI SDK calls)

### Step 3: Check for Common Issues

1. **Missing API key**: Check if provider has valid key
2. **SSE headers**: Verify Content-Type: text/event-stream
3. **Uncaught exception**: Look for try-catch in route
4. **Stream not awaited**: Check async/await usage

### Step 4: Check Configuration

```bash
cat ~/.stargazer/config.json
cat ~/.stargazer/secrets/secrets.json 2>/dev/null || echo "No secrets"
```

## Fix

Based on findings:
- Add proper error handling to SSE route
- Send error events instead of silent failures
- Ensure API key exists before starting stream
- Display actual error in CLI, not generic message

Run after fix:
```bash
npm run type-check
npx vitest run
```
