# Feature: Sessions

## Overview

Sessions track user activity within Stargazer for analytics and potential resume functionality. Events are stored in JSONL format per project.

## Key Files

| File | Purpose |
|------|---------|
| `packages/schemas/src/session.ts` | Session and event schemas |
| `packages/core/src/storage/session-events.ts` | Event persistence layer |
| `packages/core/src/storage/sessions.ts` | Session CRUD operations |
| `apps/cli/src/hooks/use-session-events.ts` | React hook for events |

## Data Model

### SessionEvent

Individual tracked events:

```typescript
interface SessionEvent {
  ts: number;      // Unix timestamp (ms)
  type: SessionEventType;
  payload: unknown;
}
```

### Event Types

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `NAVIGATE` | Screen change | `{ from: string, to: string }` |
| `OPEN_ISSUE` | Issue drilldown | `{ issueId: string }` |
| `TOGGLE_VIEW` | View mode change | `{ view: string }` |
| `APPLY_PATCH` | Patch applied | `{ issueId: string, success: boolean }` |
| `IGNORE_ISSUE` | Issue dismissed | `{ issueId: string }` |
| `FILTER_CHANGED` | Filter update | `{ filter: object }` |
| `RUN_CREATED` | New review | `{ runId: string, lenses: string[] }` |
| `RUN_RESUMED` | Resume review | `{ runId: string }` |
| `SETTINGS_CHANGED` | Settings update | `{ key: string, value: unknown }` |

### SessionMetadata

Session metadata for listing:

```typescript
interface SessionMetadata {
  id: string;
  projectPath: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
```

## Storage Format

Events are stored as JSONL (one JSON object per line):

```
~/.local/share/stargazer/projects/<projectId>/sessions/<sessionId>.jsonl
```

Example file content:
```json
{"ts":1706097600000,"type":"NAVIGATE","payload":{"from":"main","to":"review"}}
{"ts":1706097605000,"type":"OPEN_ISSUE","payload":{"issueId":"abc123"}}
{"ts":1706097610000,"type":"APPLY_PATCH","payload":{"issueId":"abc123","success":true}}
```

## Storage Functions

```typescript
import {
  createEventSession,
  appendEvent,
  loadEvents,
  listEventSessions,
} from "@repo/core/storage";

// Create new session
const sessionId = await createEventSession(projectId);

// Append event
await appendEvent(projectId, sessionId, {
  ts: Date.now(),
  type: "NAVIGATE",
  payload: { from: "main", to: "review" },
});

// Load session events
const events = await loadEvents(projectId, sessionId);

// List all sessions for project
const sessions = await listEventSessions(projectId);
```

### SessionMetadataInfo

Returned by `listEventSessions`:

```typescript
interface SessionMetadataInfo {
  sessionId: string;
  createdAt: number;    // Unix timestamp (ms)
  eventCount: number;
}
```

## CLI Integration

```typescript
import { useSessionEvents } from "@/hooks/use-session-events";

function ReviewScreen() {
  const { trackEvent } = useSessionEvents();

  const handleIssueOpen = (issueId: string) => {
    trackEvent("OPEN_ISSUE", { issueId });
    // ... open issue
  };

  const handlePatchApply = (issueId: string, success: boolean) => {
    trackEvent("APPLY_PATCH", { issueId, success });
  };
}
```

## Session ID Format

Session IDs are generated as `{timestamp}-{random}`:

```typescript
function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}
// Example: "1706097600000-a1b2c3d4"
```

The timestamp prefix enables chronological sorting without parsing the file.

## Error Handling

Session operations return `Result<T, SessionEventError>`:

| Error Code | Cause |
|------------|-------|
| `NOT_FOUND` | Session file does not exist |
| `PARSE_ERROR` | Malformed JSON in session file |
| `WRITE_ERROR` | Failed to write to session file |
| `PERMISSION_ERROR` | File permission denied |

Malformed lines in JSONL files are silently skipped during loading to maintain robustness.

## Cross-References

- [Packages: Schemas](../packages/schemas.md) - Session schemas
- [Packages: Core](../packages/core.md) - Storage layer
- [Features: Review Flow](./review-flow.md) - Review event tracking
