# TASK-013: Add Standalone Review Command

## Metadata

- **Priority**: P1 (Important - quick review without session)
- **Agent**: `backend-developer`
- **Dependencies**: TASK-008 (chat wired in - so we have the full flow)
- **Package**: `apps/cli`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Standalone Review).

Users should be able to run a quick code review without starting a full session. This is like Bugbot's quick PR review - just analyze and report.

Command: `stargazer review`

## Current State

### File: `apps/cli/src/index.ts`

```typescript
const program = new Command();

program
  .name("stargazer")
  .description("Local AI code reviewer")
  .version("0.1.0");

program
  .command("run")
  // ... existing run command

program
  .command("serve")
  // ... existing serve command

// No 'review' command exists
```

## Target State

### Update: `apps/cli/src/index.ts`

```typescript
import { reviewCommand } from "./commands/review.js";

// Add after other commands
program
  .command("review")
  .description("Quick code review without starting a session")
  .option("-s, --staged", "Review staged changes (default)", true)
  .option("-u, --unstaged", "Review unstaged changes")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-H, --hostname <hostname>", "Server hostname", "localhost")
  .action(reviewCommand);
```

### New File: `apps/cli/src/commands/review.ts`

```typescript
import { render } from "ink";
import React from "react";
import { initializeServer, stopServer } from "../lib/server.js";
import { setBaseUrl } from "@repo/api/client";
import { StandaloneReview } from "../features/review/components/standalone-review.js";

interface ReviewOptions {
  staged?: boolean;
  unstaged?: boolean;
  port: string;
  hostname: string;
}

export async function reviewCommand(options: ReviewOptions): Promise<void> {
  const port = parseInt(options.port, 10);
  const hostname = options.hostname;
  const staged = options.unstaged ? false : true;

  // Start server
  const address = await initializeServer(port, hostname);
  setBaseUrl(address);

  // Render standalone review component
  const { waitUntilExit } = render(
    React.createElement(StandaloneReview, { staged, address })
  );

  // Handle exit
  process.on("SIGINT", async () => {
    await stopServer();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await stopServer();
    process.exit(0);
  });

  await waitUntilExit();
  await stopServer();
}
```

### New File: `apps/cli/src/features/review/components/standalone-review.tsx`

```typescript
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { useEffect } from "react";
import { useReview } from "../hooks/use-review.js";
import { ReviewDisplay } from "./review-display.js";

interface StandaloneReviewProps {
  staged: boolean;
  address: string;
}

export function StandaloneReview({ staged }: StandaloneReviewProps) {
  const { exit } = useApp();
  const { state, startReview } = useReview();

  // Start review on mount
  useEffect(() => {
    startReview(staged);
  }, [staged, startReview]);

  // Exit when complete or error (after a short delay for reading)
  useEffect(() => {
    if (state.status === "success" || state.status === "error") {
      const timer = setTimeout(() => {
        exit();
      }, 100); // Small delay to ensure output is rendered
      return () => clearTimeout(timer);
    }
  }, [state.status, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Stargazer Code Review
        </Text>
        <Text color="gray"> ({staged ? "staged" : "unstaged"} changes)</Text>
      </Box>

      {state.status === "idle" && (
        <Text color="gray">Initializing...</Text>
      )}

      {state.status === "loading" && (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text> Analyzing code...</Text>
          </Box>
          {state.content && (
            <Box marginTop={1}>
              <Text color="gray">{state.content.slice(-200)}</Text>
            </Box>
          )}
        </Box>
      )}

      {state.status === "success" && (
        <Box flexDirection="column">
          <ReviewDisplay state={state} />
          <Box marginTop={1}>
            <Text color="green">Review complete. Saved to history.</Text>
          </Box>
        </Box>
      )}

      {state.status === "error" && (
        <Box>
          <Text color="red">Error: {state.error.message}</Text>
        </Box>
      )}
    </Box>
  );
}
```

## Files to Create/Modify

1. **Create** `apps/cli/src/commands/review.ts`
   - Command handler for standalone review

2. **Create** `apps/cli/src/features/review/components/standalone-review.tsx`
   - Component for standalone review output

3. **Update** `apps/cli/src/index.ts`
   - Add `review` command

## Acceptance Criteria

- [ ] `stargazer review` command works
- [ ] Reviews staged changes by default
- [ ] `--unstaged` flag reviews unstaged changes
- [ ] Shows spinner during analysis
- [ ] Displays review results
- [ ] Exits after completion
- [ ] Review saved with `sessionId: null`
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/cli build
pnpm typecheck

# Manual test:
# 1. Make some changes to files
# 2. git add some-file.ts
# 3. stargazer review
# 4. Should see review results and exit
# 5. stargazer run -> h (history) should show the review
```

## Notes

- This is a one-shot command - no interactive session.
- Server is started and stopped for the review.
- Uses existing useReview hook for the actual review logic.
- The review is standalone (sessionId: null) and can be discussed later.
