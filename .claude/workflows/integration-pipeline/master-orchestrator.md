# Integration Pipeline - Master Orchestrator

## Overview

This orchestrator **connects all existing pieces** of Stargazer into a fully working agentic code review system. It is **self-contained** for empty AI context execution.

**Goal:** Wire streaming events, parallel execution, UI integration, and GitHub Actions improvements.

---

## Project Context

### What is Stargazer
Local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

### Tech Stack
- TypeScript, React 19 (Ink for CLI), Chalk, Hono (server), Zod, Vitest
- Vercel AI SDK for multi-provider support

### Monorepo Structure
```
packages/
├── core/       # Business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF PACKAGE
├── api/        # API client - LEAF PACKAGE
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI (primary interface)
```

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security (CVE-2024-28224)
4. **XML Escaping** - Prompts (CVE-2025-53773)
5. **Zod responseSchema** - For AI JSON output
6. **No Manual Memoization** - React 19 Compiler handles it

### Architecture Rules
- Import flow: apps -> packages, packages/core -> schemas
- ALL files use kebab-case naming
- Features CANNOT import from other features
- Tests co-located with source files

---

## Current State (What Exists)

### Already Built (DO NOT REBUILD)

**Schemas:**
- `packages/schemas/src/agent-event.ts` - Agent events, LENS_TO_AGENT mapping
- `packages/schemas/src/feedback.ts` - Feedback commands
- `packages/schemas/src/stream-events.ts` - Combined stream events
- `packages/schemas/src/session.ts` - Session events

**Core:**
- `packages/core/src/review/triage.ts` - Has `triageReviewStream()` function
- `packages/core/src/review/drilldown.ts` - Deep analysis
- `packages/core/src/review/drilldown-suggester.ts` - Proactive suggestions
- `packages/core/src/review/trace-recorder.ts` - Tool call recording
- `packages/core/src/review/fingerprint.ts` - Issue deduplication

**CLI Components:**
- `apps/cli/src/features/review/components/agent-activity-panel.tsx`
- `apps/cli/src/features/review/components/review-split-screen.tsx`
- `apps/cli/src/features/review/components/issue-list-pane.tsx`
- `apps/cli/src/features/review/components/issue-details-pane.tsx`
- `apps/cli/src/features/review/components/drilldown-prompt.tsx`
- `apps/cli/src/features/review/components/feedback-input.tsx`
- `apps/cli/src/features/review/hooks/use-agent-activity.ts`
- `apps/cli/src/features/review/hooks/use-review-keyboard.ts`

**Server:**
- `apps/server/src/api/routes/triage.ts` - SSE endpoint exists
- `apps/server/src/api/routes/pr-review.ts` - PR review endpoint
- `.github/workflows/ai-review.yml` - GitHub Actions workflow

---

## What's NOT Connected (Gaps)

1. **Triage streaming not wired to SSE** - Server uses old non-streaming call
2. **Parallel execution** - Lenses run sequentially, should use Promise.all
3. **Agent events not forwarded** - SSE doesn't emit AgentStreamEvent
4. **UI doesn't receive events** - useAgentActivity not connected to stream
5. **Settings not wired** - SettingsView shows placeholder data
6. **Onboarding incomplete** - Trust step missing, flow broken

---

## Phase Summary

| Phase | Deliverable | Priority |
|-------|-------------|----------|
| 1 | Wire streaming triage to server | CRITICAL |
| 2 | Parallel lens execution | CRITICAL |
| 3 | Connect UI to agent events | CRITICAL |
| 4 | Wire settings and onboarding | HIGH |
| 5 | GitHub Actions improvements | MEDIUM |
| 6 | Final integration testing | REQUIRED |

---

## PHASE 1: Wire Streaming Triage to Server

### Agent 1.1: Update Triage Service to Use Streaming

```
subagent_type: "backend-development:backend-architect"

Task: Update server triage service to use triageReviewStream and emit agent events.

Read first:
- packages/core/src/review/triage.ts (find triageReviewStream signature)
- apps/server/src/services/triage.ts (current implementation)
- packages/schemas/src/agent-event.ts (event types)

Modify: apps/server/src/services/triage.ts

Current problem:
The server calls triageReview() in a for-loop per lens, missing all the
agent events (tool_call, agent_thinking, issue_found) that triageReviewStream emits.

Required changes:

1. Import AgentStreamEvent from @repo/schemas
2. Replace the for-loop with single triageReviewStream() call
3. Forward all AgentStreamEvent to SSE via the writer

The triageReviewStream signature is:
```typescript
export async function triageReviewStream(
  client: AIClient,
  diff: string,
  options: TriageOptions & {
    onEvent?: (event: AgentStreamEvent) => void;
  }
): Promise<Result<TriageResult, TriageError>>
```

Wire it like this:
```typescript
const result = await triageReviewStream(client, diff, {
  lenses: selectedLenses,
  severityFilter: profile?.filter?.minSeverity,
  onEvent: (event) => {
    // Forward agent event to SSE
    writeSSE(writer, event.type, event);
  },
});
```

Remove the old for-loop that iterates over lenses manually.

Steps:
1. Read current implementation
2. Update imports
3. Replace loop with triageReviewStream
4. Forward events to SSE
5. Run: npm run type-check

Output: Triage service uses streaming
```

### Agent 1.2: Update SSE Route Event Types

```
subagent_type: "backend-development:backend-architect"

Task: Ensure SSE route handles all agent event types.

Read first:
- apps/server/src/api/routes/triage.ts
- packages/schemas/src/agent-event.ts

Modify: apps/server/src/api/routes/triage.ts

Ensure the route:
1. Accepts all AgentStreamEvent types
2. Uses correct SSE event names for each type
3. Properly serializes events

SSE format for each event type:
```
event: agent_start
data: {"type":"agent_start","agent":{"id":"detective",...},"timestamp":"..."}

event: agent_thinking
data: {"type":"agent_thinking","agent":"detective","thought":"...","timestamp":"..."}

event: tool_call
data: {"type":"tool_call","agent":"detective","tool":"readFile","input":"...","timestamp":"..."}

event: tool_result
data: {"type":"tool_result","agent":"detective","tool":"readFile","summary":"...","timestamp":"..."}

event: issue_found
data: {"type":"issue_found","agent":"detective","issue":{...},"timestamp":"..."}

event: agent_complete
data: {"type":"agent_complete","agent":"detective","issueCount":3,"timestamp":"..."}

event: orchestrator_complete
data: {"type":"orchestrator_complete","summary":"...","totalIssues":7,"timestamp":"..."}
```

The writeSSE helper should already handle this, but verify it uses event.type as the event name.

Steps:
1. Verify writeSSE implementation
2. Update if needed to use event.type
3. Run: npm run type-check

Output: SSE emits all agent events
```

---

## PHASE 2: Parallel Lens Execution

### Agent 2.1: Refactor Triage to Run Lenses in Parallel

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Modify triage to run lenses in parallel using Promise.all.

Read first:
- packages/core/src/review/triage.ts

Modify: packages/core/src/review/triage.ts

Current: Lenses run sequentially in a for-loop
New: Run with Promise.all for parallel execution

Find the section in triageReviewStream that looks like:
```typescript
for (const lens of selectedLenses) {
  // ... run lens
}
```

Replace with:
```typescript
const lensPromises = selectedLenses.map(async (lensId) => {
  const agent = LENS_TO_AGENT[lensId];
  const meta = AGENT_METADATA[agent];

  // Emit start event
  onEvent?.({
    type: "agent_start",
    agent: meta,
    timestamp: new Date().toISOString()
  });

  // Emit thinking event
  onEvent?.({
    type: "agent_thinking",
    agent,
    thought: `Analyzing code for ${meta.description.toLowerCase()}...`,
    timestamp: new Date().toISOString(),
  });

  // Run the lens analysis
  const lensResult = await runSingleLensReview(client, diff, lensId, onEvent);

  // Emit complete event
  onEvent?.({
    type: "agent_complete",
    agent,
    issueCount: lensResult.length,
    timestamp: new Date().toISOString(),
  });

  return lensResult;
});

const allResults = await Promise.all(lensPromises);
const allIssues = allResults.flat();
```

Benefits:
- Faster execution (parallel vs sequential)
- Natural event interleaving (multiple agents working)
- More "agentic" feel for the user

Important: Keep error handling - if one lens fails, others should continue.
Use Promise.allSettled if needed, then filter fulfilled results.

Steps:
1. Read current implementation
2. Identify the sequential loop
3. Refactor to Promise.all
4. Add thinking events
5. Test with multiple lenses
6. Run: npm run type-check && npx vitest run packages/core

Output: Parallel lens execution working
```

### Agent 2.2: Add Tool Call Events for File Reading

```
subagent_type: "llm-application-dev:ai-engineer"

Task: Add tool_call and tool_result events when reading file context.

Read first:
- packages/core/src/review/triage.ts
- packages/core/src/review/drilldown.ts

Modify: packages/core/src/review/triage.ts and drilldown.ts

When the triage or drilldown reads file context, emit tool events:

Before reading:
```typescript
onEvent?.({
  type: "tool_call",
  agent: agentId,
  tool: "readFileContext",
  input: `${file}:${startLine}-${endLine}`,
  timestamp: new Date().toISOString(),
});
```

After reading:
```typescript
onEvent?.({
  type: "tool_result",
  agent: agentId,
  tool: "readFileContext",
  summary: `Read ${lineCount} lines from ${file}`,
  timestamp: new Date().toISOString(),
});
```

Also add for other tools:
- repoSearch: when searching codebase
- gitBlame: when getting blame info
- runTest: when running tests (if applicable)

This makes the agent's work visible to the user.

Steps:
1. Identify file reading operations
2. Wrap with tool_call/tool_result events
3. Run: npm run type-check

Output: Tool events emitted
```

---

## PHASE 3: Connect UI to Agent Events

### Agent 3.1: Update Triage API to Parse Agent Events

```
subagent_type: "react-component-architect"

Task: Update CLI triage API to parse and forward agent events.

Read first:
- apps/cli/src/features/review/api/triage-api.ts
- packages/schemas/src/agent-event.ts

Modify: apps/cli/src/features/review/api/triage-api.ts

The API should:
1. Parse SSE events that are AgentStreamEvent type
2. Forward them via a callback
3. Accumulate issues for final result

Update streamTriage function signature:
```typescript
interface StreamTriageOptions {
  // existing options...
  onAgentEvent?: (event: AgentStreamEvent) => void;
}

export async function streamTriage(
  options: StreamTriageOptions
): Promise<Result<TriageResult, ApiError>>
```

In the SSE parsing loop, handle agent events:
```typescript
switch (event.type) {
  case 'agent_start':
  case 'agent_thinking':
  case 'tool_call':
  case 'tool_result':
  case 'issue_found':
  case 'agent_complete':
  case 'orchestrator_complete':
    options.onAgentEvent?.(event as AgentStreamEvent);
    break;
  // ... existing handlers
}
```

Steps:
1. Read current implementation
2. Add AgentStreamEvent handling
3. Update export types
4. Run: npm run type-check

Output: API forwards agent events
```

### Agent 3.2: Wire useAgentActivity to Stream Events

```
subagent_type: "react-component-architect"

Task: Connect useAgentActivity hook to receive events from triage stream.

Read first:
- apps/cli/src/features/review/hooks/use-agent-activity.ts
- apps/cli/src/features/review/hooks/use-triage.ts

Modify: apps/cli/src/features/review/hooks/use-triage.ts

The useTriage hook should:
1. Accept onAgentEvent callback
2. Forward events from streamTriage
3. Track events in state for useAgentActivity

Add to useTriage:
```typescript
const [agentEvents, setAgentEvents] = useState<AgentStreamEvent[]>([]);

const startTriage = useCallback(async () => {
  setAgentEvents([]);

  const result = await streamTriage({
    // existing options...
    onAgentEvent: (event) => {
      setAgentEvents(prev => [...prev, event]);
    },
  });

  // ... rest of handler
}, [/* deps */]);

return {
  // existing returns...
  agentEvents,
};
```

Then useAgentActivity will derive state from agentEvents:
```typescript
const { agents, isRunning, progress } = useAgentActivity(agentEvents);
```

Steps:
1. Read current useTriage implementation
2. Add agentEvents state
3. Wire to streamTriage
4. Export agentEvents
5. Run: npm run type-check

Output: Triage hook captures agent events
```

### Agent 3.3: Integrate Agent Panel into Review View

```
subagent_type: "react-component-architect"

Task: Show AgentActivityPanel in review view during triage.

Read first:
- apps/cli/src/app/views/review-view.tsx
- apps/cli/src/features/review/components/agent-activity-panel.tsx
- apps/cli/src/features/review/hooks/use-agent-activity.ts

Modify: apps/cli/src/app/views/review-view.tsx

Add agent activity panel that shows during review:

```tsx
import { AgentActivityPanel } from '@/features/review/components/agent-activity-panel';
import { useAgentActivity } from '@/features/review/hooks/use-agent-activity';

// In the component:
const { agentEvents, isLoading, result } = useTriage();
const { agents, isRunning, progress, currentAction } = useAgentActivity(agentEvents);

// In the render:
{isLoading && (
  <AgentActivityPanel
    agents={agents}
    currentAction={currentAction}
    progress={progress}
  />
)}

{!isLoading && result && (
  <ReviewSplitScreen
    issues={result.issues}
    // ... other props
  />
)}
```

The panel should appear DURING triage and hide when complete.
Review split screen appears AFTER triage completes.

Steps:
1. Import components and hooks
2. Wire up agent activity state
3. Conditional render based on isLoading
4. Test the flow
5. Run: npm run type-check

Output: Agent panel visible during review
```

### Agent 3.4: Update Review Split Screen Layout

```
subagent_type: "react-component-architect"

Task: Update split screen to optionally show agent panel alongside issues.

Read first:
- apps/cli/src/features/review/components/review-split-screen.tsx

Modify: apps/cli/src/features/review/components/review-split-screen.tsx

Add optional agent activity sidebar:

Props addition:
```typescript
interface ReviewSplitScreenProps {
  // existing props...
  agentEvents?: AgentStreamEvent[];
  showAgentPanel?: boolean;
}
```

Layout when showAgentPanel is true (3 columns):
```
┌────────────────┬──────────────────┬─────────────────────────────┐
│ Agent Activity │ Issues (35%)     │ Details (remaining)         │
│ (15% fixed)    │                  │                             │
└────────────────┴──────────────────┴─────────────────────────────┘
```

Layout when false (2 columns):
```
┌─────────────────────┬───────────────────────────────────────────┐
│ Issues (40%)        │ Details (60%)                             │
└─────────────────────┴───────────────────────────────────────────┘
```

Use Box with flexDirection="row" and appropriate width props.

Steps:
1. Add new props
2. Implement 3-column layout
3. Conditional rendering
4. Test both layouts
5. Run: npm run type-check

Output: Split screen with optional agent panel
```

---

## PHASE 4: Wire Settings and Onboarding

### Agent 4.1: Create Provider Status API

```
subagent_type: "backend-development:backend-architect"

Task: Add endpoint to get configured provider status.

Read first:
- apps/server/src/api/routes/config.ts
- packages/core/src/storage/config.ts

Modify: apps/server/src/api/routes/config.ts

Add endpoint GET /config/providers that returns:
```typescript
interface ProviderStatus {
  provider: string;
  configured: boolean;
  model?: string;
}

// Response
{
  providers: [
    { provider: "gemini", configured: true, model: "gemini-2.5-flash" },
    { provider: "openai", configured: false },
    { provider: "anthropic", configured: false },
  ],
  activeProvider: "gemini" | null,
}
```

Implementation:
```typescript
configRouter.get('/providers', async (c) => {
  const config = await getStoredConfig();

  // Check which providers have API keys
  const providers = AI_PROVIDERS.map(provider => ({
    provider,
    configured: hasApiKey(provider), // Check env or keyring
    model: config?.provider === provider ? config.model : undefined,
  }));

  return c.json({
    providers,
    activeProvider: config?.provider ?? null,
  });
});
```

Steps:
1. Read current config route
2. Add /providers endpoint
3. Check API key availability
4. Return status
5. Run: npm run type-check

Output: Provider status endpoint
```

### Agent 4.2: Wire SettingsView to Real Data

```
subagent_type: "react-component-architect"

Task: Connect SettingsView to actual configuration data.

Read first:
- apps/cli/src/app/views/settings-view.tsx (or settings-screen.tsx)
- apps/cli/src/hooks/use-config.ts
- apps/cli/src/hooks/use-settings.ts

Modify: apps/cli/src/app/views/settings-view.tsx (or equivalent)

Current problem: View shows "[Not Configured]" placeholders.

Solution:
1. Use useConfig hook to fetch provider status
2. Use useSettings hook for theme/controls
3. Pass real data to components

```tsx
const SettingsView = () => {
  const { providers, activeProvider, isLoading } = useConfig();
  const { settings, updateSettings } = useSettings();

  if (isLoading) return <Spinner />;

  return (
    <Box flexDirection="column">
      <SettingsSection title="AI Provider">
        <ProviderList
          providers={providers}
          activeProvider={activeProvider}
          onSelect={handleProviderSelect}
        />
      </SettingsSection>

      <SettingsSection title="Theme">
        <ThemePicker
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
      </SettingsSection>

      <SettingsSection title="Controls">
        <ControlsPicker
          value={settings.controlsMode}
          onChange={(mode) => updateSettings({ controlsMode: mode })}
        />
      </SettingsSection>
    </Box>
  );
};
```

Steps:
1. Import and use hooks
2. Replace placeholders with real data
3. Wire onChange handlers
4. Run: npm run type-check

Output: Settings show real configuration
```

### Agent 4.3: Implement Trust Step in Onboarding

```
subagent_type: "react-component-architect"

Task: Create and wire the Trust step for onboarding.

Read first:
- apps/cli/src/app/screens/onboarding-screen.tsx
- apps/cli/src/components/wizard/
- packages/schemas/src/settings.ts (TrustConfig)

Create: apps/cli/src/components/wizard/trust-step.tsx

The Trust step should:
1. Show current directory path
2. Explain what Stargazer will access
3. Allow capability toggles
4. Save trust configuration

```tsx
interface TrustStepProps {
  repoRoot: string;
  onComplete: (trust: TrustConfig) => void;
  onSkip: () => void;
}

const TrustStep = ({ repoRoot, onComplete, onSkip }: TrustStepProps) => {
  const [capabilities, setCapabilities] = useState<TrustCapabilities>({
    readFiles: true,
    readGit: true,
    runCommands: false,
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Do you trust this directory?</Text>
      <Text dimColor>{repoRoot}</Text>

      <Box marginTop={1}>
        <Text>Stargazer will:</Text>
      </Box>

      <ToggleList
        items={[
          { label: "Read repository files", key: "readFiles", checked: capabilities.readFiles },
          { label: "Read git metadata", key: "readGit", checked: capabilities.readGit },
          { label: "Run commands (tests/lint)", key: "runCommands", checked: capabilities.runCommands },
        ]}
        onChange={(key, checked) => setCapabilities(prev => ({ ...prev, [key]: checked }))}
      />

      <Box marginTop={1} gap={2}>
        <Button onPress={() => onComplete({ ...capabilities, trustMode: 'persistent' })}>
          Trust & Continue
        </Button>
        <Button onPress={() => onComplete({ ...capabilities, trustMode: 'session' })}>
          Trust Once
        </Button>
        <Button onPress={onSkip}>
          Skip
        </Button>
      </Box>
    </Box>
  );
};
```

Then update onboarding-screen.tsx to include TrustStep as Step 0.

Steps:
1. Create trust-step.tsx
2. Export from wizard/index.ts
3. Update onboarding flow
4. Wire trust storage
5. Run: npm run type-check

Output: Trust step in onboarding
```

### Agent 4.4: Complete Onboarding Flow

```
subagent_type: "react-component-architect"

Task: Wire complete onboarding flow with all steps.

Read first:
- apps/cli/src/app/screens/onboarding-screen.tsx
- apps/cli/src/components/wizard/

Modify: apps/cli/src/app/screens/onboarding-screen.tsx

Ensure the flow is:
1. Trust Step (Step 0) - Directory trust
2. Theme Step (Step 1) - Theme selection
3. Provider Step (Step 2) - AI provider selection
4. Credentials Step (Step 3) - API key input
5. Controls Step (Step 4) - Menu vs Key mode
6. Summary Step (Step 5) - Review and confirm

State machine:
```typescript
type WizardState =
  | { step: 'trust' }
  | { step: 'theme' }
  | { step: 'provider' }
  | { step: 'credentials', provider: AIProvider }
  | { step: 'controls' }
  | { step: 'summary' }
  | { step: 'complete' };

const [state, setState] = useState<WizardState>({ step: 'trust' });
```

Each step calls onNext which advances state.
On 'complete', save all settings and navigate to home.

Progress indicator: "Setup - Step X/6"

Steps:
1. Define state machine
2. Render correct step
3. Handle transitions
4. Save on complete
5. Run: npm run type-check

Output: Complete onboarding wizard
```

---

## PHASE 5: GitHub Actions Improvements

### Agent 5.1: Add Inline PR Comments

```
subagent_type: "backend-development:backend-architect"

Task: Update PR review endpoint to return inline comment format.

Read first:
- apps/server/src/api/routes/pr-review.ts

Modify: apps/server/src/api/routes/pr-review.ts

Add inline comments to response:
```typescript
interface InlineComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

// In response
{
  // existing fields...
  inlineComments: InlineComment[],
}
```

Create inline comment body with markdown:
```typescript
function issueToInlineComment(issue: TriageIssue): InlineComment | null {
  if (!issue.file || !issue.line_start) return null;

  const severityEmoji = {
    blocker: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    nit: '⚪',
  }[issue.severity];

  const body = [
    `${severityEmoji} **${issue.severity.toUpperCase()}**: ${issue.title}`,
    '',
    issue.symptom || issue.rationale,
    '',
    issue.recommendation ? `**Suggestion:** ${issue.recommendation}` : '',
    issue.suggested_patch ? `\`\`\`suggestion\n${issue.suggested_patch}\n\`\`\`` : '',
  ].filter(Boolean).join('\n');

  return {
    path: issue.file,
    line: issue.line_start,
    side: "RIGHT",
    body,
  };
}
```

Steps:
1. Add InlineComment type
2. Create conversion function
3. Add to response
4. Run: npm run type-check

Output: Inline comments in response
```

### Agent 5.2: Update GitHub Actions to Post Inline Comments

```
subagent_type: "backend-development:devops-engineer"

Task: Update GitHub Actions workflow to post inline PR comments.

Read first:
- .github/workflows/ai-review.yml

Modify: .github/workflows/ai-review.yml

After getting review results, post as PR review with inline comments:

```yaml
- name: Post PR review with inline comments
  if: always() && steps.review.outcome == 'success'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const review = JSON.parse(fs.readFileSync('review.json', 'utf8'));

      // Filter valid inline comments
      const comments = (review.inlineComments || []).filter(c =>
        c.path && c.line && c.body
      );

      if (comments.length === 0) {
        console.log('No inline comments to post');
        return;
      }

      // Determine review event based on severity
      const hasBlocker = review.issues.some(i => i.severity === 'blocker');
      const hasHigh = review.issues.some(i => i.severity === 'high');
      const event = hasBlocker ? 'REQUEST_CHANGES' : (hasHigh ? 'COMMENT' : 'APPROVE');

      // Build review body
      let body = `## 🔭 Stargazer AI Review\n\n`;
      body += `${review.summary}\n\n`;
      body += `**Issues found:** ${review.issueCount}\n`;

      // Post review with comments
      try {
        await github.rest.pulls.createReview({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: context.issue.number,
          event: event,
          body: body,
          comments: comments.slice(0, 50), // GitHub limit
        });
        console.log(`Posted review with ${comments.length} inline comments`);
      } catch (error) {
        console.error('Failed to post review:', error);
        // Fallback to regular comment
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.issue.number,
          body: body,
        });
      }
```

Steps:
1. Update workflow file
2. Add inline comments handling
3. Add review event logic
4. Add fallback handling

Output: Inline PR comments
```

### Agent 5.3: Add Comment Trigger for AI Review

```
subagent_type: "backend-development:devops-engineer"

Task: Add /ai-review comment trigger to GitHub Actions.

Read first:
- .github/workflows/ai-review.yml

Modify: .github/workflows/ai-review.yml

Add issue_comment trigger:
```yaml
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  # Check if this is a command trigger
  check-command:
    runs-on: ubuntu-latest
    if: github.event_name == 'issue_comment'
    outputs:
      should_run: ${{ steps.check.outputs.should_run }}
      pr_number: ${{ steps.check.outputs.pr_number }}
    steps:
      - name: Check for /ai-review command
        id: check
        uses: actions/github-script@v7
        with:
          script: |
            const comment = context.payload.comment.body.trim();
            const isPR = !!context.payload.issue.pull_request;

            if (isPR && comment === '/ai-review') {
              core.setOutput('should_run', 'true');
              core.setOutput('pr_number', context.payload.issue.number);

              // React to comment
              await github.rest.reactions.createForIssueComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: context.payload.comment.id,
                content: 'rocket',
              });
            } else {
              core.setOutput('should_run', 'false');
            }

  review:
    needs: [check-command]
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && needs.check-command.outputs.should_run == 'true')
    # ... rest of job
```

This allows maintainers to trigger review on any PR by commenting `/ai-review`.

Steps:
1. Add issue_comment trigger
2. Add command check job
3. Update review job conditions
4. Add reaction feedback

Output: Comment trigger working
```

---

## PHASE 6: Final Integration Testing

### Agent 6.1: End-to-End Test Script

```
subagent_type: "unit-testing:test-automator"

Task: Create integration test script for the full flow.

Create: scripts/test-integration.sh

```bash
#!/bin/bash
set -e

echo "🔭 Stargazer Integration Test"
echo "=============================="

# Build
echo "📦 Building packages..."
npm run build

# Start server
echo "🚀 Starting server..."
npm run -w apps/server start &
SERVER_PID=$!
sleep 3

# Wait for server
echo "⏳ Waiting for server..."
for i in {1..30}; do
  if curl -s http://localhost:7860/health > /dev/null 2>&1; then
    echo "✓ Server ready"
    break
  fi
  sleep 1
done

# Test 1: Provider status
echo "📊 Testing provider status..."
curl -s http://localhost:7860/config/providers | jq .

# Test 2: Create test diff
echo "📝 Creating test diff..."
cat > /tmp/test.diff << 'EOF'
diff --git a/test.ts b/test.ts
new file mode 100644
--- /dev/null
+++ b/test.ts
@@ -0,0 +1,10 @@
+function login(username: string, password: string) {
+  const query = `SELECT * FROM users WHERE username='${username}'`;
+  return db.query(query);
+}
EOF

# Test 3: Stream triage
echo "🔍 Testing triage stream..."
curl -N -X POST http://localhost:7860/triage/stream \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d '{"diff": "'"$(cat /tmp/test.diff | jq -Rs .)"'", "lenses": ["security"]}' \
  --max-time 60 | head -50

# Test 4: PR review
echo "📋 Testing PR review..."
curl -s -X POST http://localhost:7860/pr-review \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d '{"diff": "'"$(cat /tmp/test.diff | jq -Rs .)"'", "profile": "strict"}' | jq .

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ Integration tests complete!"
```

Steps:
1. Create scripts directory if needed
2. Create test-integration.sh
3. Make executable: chmod +x scripts/test-integration.sh
4. Document in README

Output: Integration test script
```

### Agent 6.2: Manual Testing Checklist

```
subagent_type: "unit-testing:test-automator"

Task: Create manual testing checklist document.

Create: docs/testing-checklist.md

# Stargazer Testing Checklist

## Pre-release Validation

### 1. CLI Interactive Mode
- [ ] `stargazer run` starts without errors
- [ ] Onboarding wizard appears on first run
- [ ] Trust step shows correct directory
- [ ] Provider selection works
- [ ] API key input works
- [ ] Theme selection applies immediately
- [ ] Controls mode switches between menu/keys

### 2. Review Flow
- [ ] `stargazer review` triggers triage
- [ ] Agent activity panel appears during review
- [ ] Agent events stream in real-time
- [ ] Multiple agents show as running simultaneously
- [ ] Tool calls visible (e.g., "Reading auth.ts:42-55")
- [ ] Issues appear as found
- [ ] Panel collapses when review complete
- [ ] Split-pane shows issues and details

### 3. Issue Navigation
- [ ] j/k or arrow keys move selection
- [ ] Enter/o opens issue details
- [ ] Tab switches between Details/Explain/Trace/Patch
- [ ] e shows evidence
- [ ] t shows trace
- [ ] a shows apply patch
- [ ] i ignores issue

### 4. Feedback Commands
- [ ] `/focus security` filters to security issues
- [ ] `/ignore style` hides style issues
- [ ] Esc cancels command input

### 5. Settings
- [ ] Settings screen shows real provider status
- [ ] Theme change works
- [ ] Controls mode change works
- [ ] Provider change works

### 6. GitHub Actions
- [ ] PR triggers review workflow
- [ ] Annotations appear in Files Changed
- [ ] PR comment posted with summary
- [ ] Inline comments on issue lines
- [ ] `/ai-review` comment triggers review

### 7. Error Handling
- [ ] Missing API key shows clear error
- [ ] Network errors handled gracefully
- [ ] Large diffs show warning
- [ ] Empty diff handled

## Performance
- [ ] Review of 100-line diff < 30 seconds
- [ ] Review of 500-line diff < 60 seconds
- [ ] UI remains responsive during review

Steps:
1. Create docs directory if needed
2. Create testing-checklist.md
3. Reference in README

Output: Testing checklist
```

### Agent 6.3: Final Validation

```
subagent_type: "code-reviewer"

Task: Run final validation checks.

Steps:
1. Run type check: npm run type-check
2. Run all tests: npx vitest run
3. Run linter: npm run lint (if available)
4. Check for console.log statements
5. Verify all exports are used
6. Check for TODO comments without issue reference

Report any issues found.

Manual verification:
1. Start app: npm run -w apps/cli start
2. Go through onboarding
3. Run a review
4. Verify agent activity shows
5. Navigate issues
6. Check settings

Output: Final validation report
```

---

## Summary

After all phases complete:

1. ✅ Triage streaming wired to server
2. ✅ Parallel lens execution
3. ✅ UI receives and displays agent events
4. ✅ Settings wired to real data
5. ✅ Onboarding flow complete with trust step
6. ✅ GitHub Actions with inline comments
7. ✅ Integration tests passing

The result: A **fully connected, visible, agentic** code review system ready for hackathon demo.

---

## Quick Reference

### Key Files Modified
- `apps/server/src/services/triage.ts` - Streaming integration
- `apps/server/src/api/routes/triage.ts` - SSE events
- `packages/core/src/review/triage.ts` - Parallel execution
- `apps/cli/src/features/review/hooks/use-triage.ts` - Event capture
- `apps/cli/src/app/views/review-view.tsx` - Agent panel
- `apps/cli/src/app/screens/onboarding-screen.tsx` - Full wizard
- `.github/workflows/ai-review.yml` - Inline comments

### Commands
```bash
# Build
npm run build

# Type check
npm run type-check

# Run tests
npx vitest run

# Start CLI
npm run -w apps/cli start

# Start server only
npm run -w apps/server start

# Integration test
./scripts/test-integration.sh
```
