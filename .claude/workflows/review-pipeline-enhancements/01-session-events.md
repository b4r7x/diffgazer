# Phase 1: Session Event Recording

## Overview

Implement JSONL-based session event recording for history tracking and replay functionality.

**Priority:** CRITICAL
**Dependencies:** None

---

## Context

### What is Session Event Recording?

Session events track what the user does in the CLI:
- Which views they navigate to
- Which issues they open
- When they apply patches
- When they ignore issues

This enables:
- History replay ("what did I do yesterday?")
- Analytics ("which issues get ignored most?")
- Resume functionality ("continue from where I left off")

### Why JSONL?

- Append-only: Fast writes, no file locking
- Human-readable: Easy to debug
- Streamable: Can tail -f the file
- Per-line parsing: Handles partial writes gracefully

---

## Existing Code References

Read these files first:
- `packages/schemas/src/session.ts` - SessionEvent type definition
- `packages/core/src/storage/paths.ts` - Storage path helpers
- `packages/core/src/storage/persistence.ts` - File operation patterns
- `packages/core/src/result.ts` - Result<T, E> type

---

## Agent 1.1: Core Session Events Storage

```
subagent_type: "backend-development:backend-architect"

Task: Implement JSONL session event storage in packages/core.

Create: packages/core/src/storage/session-events.ts

IMPORTANT:
- Use Result<T, E> for all operations
- Follow existing patterns in persistence.ts
- Use kebab-case for file name

Implementation:

import { Result, ok, err } from '../result';
import { SessionEvent } from '@repo/schemas';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getStorageDir } from './paths';

// Get session file path
function getSessionPath(sessionId: string): string {
  return path.join(getStorageDir(), 'sessions', `${sessionId}.jsonl`);
}

// Create session file
export async function createSessionFile(sessionId: string): Promise<Result<string, Error>> {
  const sessionPath = getSessionPath(sessionId);
  try {
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.writeFile(sessionPath, '', { flag: 'wx' }); // fail if exists
    return ok(sessionPath);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Append event to session file
export async function appendSessionEvent(
  sessionId: string,
  event: Omit<SessionEvent, 'ts'>
): Promise<Result<void, Error>> {
  const sessionPath = getSessionPath(sessionId);
  const eventWithTs: SessionEvent = {
    ts: new Date().toISOString(),
    ...event,
  };
  try {
    await fs.appendFile(sessionPath, JSON.stringify(eventWithTs) + '\n');
    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Load all events from session
export async function loadSessionEvents(
  sessionId: string
): Promise<Result<SessionEvent[], Error>> {
  const sessionPath = getSessionPath(sessionId);
  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const events = lines.map(line => JSON.parse(line) as SessionEvent);
    return ok(events);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok([]); // No session file = empty events
    }
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// List all sessions for a project
export async function listSessions(
  projectId: string
): Promise<Result<string[], Error>> {
  const sessionsDir = path.join(getStorageDir(), 'sessions');
  try {
    const files = await fs.readdir(sessionsDir);
    // Filter by projectId prefix if we use that naming convention
    const sessionIds = files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''));
    return ok(sessionIds);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok([]);
    }
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Generate session ID
export function generateSessionId(projectId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${projectId.substring(0, 8)}-${timestamp}-${random}`;
}

Update: packages/core/src/storage/index.ts
- Add exports for new functions

Steps:
1. Read existing storage code
2. Create session-events.ts
3. Export from index.ts
4. Run: npm run type-check
5. Create basic test: session-events.test.ts

Output: Session events storage with tests
```

---

## Agent 1.2: Session Recorder Hook

```
subagent_type: "react-component-architect"

Task: Create React hook for recording session events in CLI.

Create: apps/cli/src/hooks/use-session-recorder.ts

IMPORTANT:
- Hook name must start with "use"
- File must be kebab-case
- Non-blocking recording (don't await in event handlers)
- Log errors but don't throw

Implementation:

import { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { appendSessionEvent, createSessionFile, generateSessionId } from '@repo/core/storage';
import type { SessionEvent } from '@repo/schemas';

type SessionEventType = SessionEvent['type'];

interface SessionRecorderContextValue {
  sessionId: string | null;
  recordEvent: (type: SessionEventType, payload?: Record<string, unknown>) => void;
}

export const SessionRecorderContext = createContext<SessionRecorderContextValue>({
  sessionId: null,
  recordEvent: () => {},
});

interface UseSessionRecorderOptions {
  projectId: string;
  autoCreate?: boolean; // Create session on mount, default true
}

export function useSessionRecorderProvider(options: UseSessionRecorderOptions) {
  const { projectId, autoCreate = true } = options;
  const sessionIdRef = useRef<string | null>(null);
  const initializingRef = useRef(false);

  // Initialize session on mount
  useEffect(() => {
    if (!autoCreate || initializingRef.current) return;
    initializingRef.current = true;

    const init = async () => {
      const id = generateSessionId(projectId);
      const result = await createSessionFile(id);
      if (result.ok) {
        sessionIdRef.current = id;
        // Record session start
        appendSessionEvent(id, { type: 'RUN_CREATED', payload: { projectId } });
      }
    };
    init();
  }, [projectId, autoCreate]);

  const recordEvent = useCallback((
    type: SessionEventType,
    payload: Record<string, unknown> = {}
  ) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    // Fire and forget - don't block UI
    appendSessionEvent(sessionId, { type, payload }).then(result => {
      if (!result.ok) {
        console.error('Failed to record session event:', result.error);
      }
    });
  }, []);

  return {
    sessionId: sessionIdRef.current,
    recordEvent,
  };
}

export function useSessionRecorder() {
  return useContext(SessionRecorderContext);
}

Create: apps/cli/src/hooks/use-session-recorder.tsx (Provider component)

import { ReactNode } from 'react';
import { SessionRecorderContext, useSessionRecorderProvider } from './use-session-recorder';

interface SessionRecorderProviderProps {
  projectId: string;
  children: ReactNode;
}

export function SessionRecorderProvider({ projectId, children }: SessionRecorderProviderProps) {
  const value = useSessionRecorderProvider({ projectId });
  return (
    <SessionRecorderContext.Provider value={value}>
      {children}
    </SessionRecorderContext.Provider>
  );
}

Update: apps/cli/src/hooks/index.ts
- Export useSessionRecorder
- Export SessionRecorderProvider

Steps:
1. Create use-session-recorder.ts
2. Create provider component
3. Export from index.ts
4. Run: npm run type-check

Output: Session recorder hook and provider
```

---

## Agent 1.3: Integration into App

```
subagent_type: "react-component-architect"

Task: Wire session recording into app navigation and review actions.

Modify: apps/cli/src/app/app.tsx

Changes:
1. Import SessionRecorderProvider
2. Calculate projectId from current working directory (hash of path)
3. Wrap app content with SessionRecorderProvider

Example:
import { SessionRecorderProvider } from '@/hooks';
import { createHash } from 'node:crypto';

function getProjectId(): string {
  const cwd = process.cwd();
  return createHash('sha256').update(cwd).digest('hex').substring(0, 16);
}

function App() {
  const projectId = getProjectId();

  return (
    <SessionRecorderProvider projectId={projectId}>
      {/* existing app content */}
    </SessionRecorderProvider>
  );
}

---

Modify: apps/cli/src/features/app/hooks/use-navigation.ts

Changes:
1. Import useSessionRecorder
2. Record NAVIGATE events when view changes

Example:
const { recordEvent } = useSessionRecorder();

const navigate = useCallback((to: View) => {
  recordEvent('NAVIGATE', { from: currentView, to });
  setCurrentView(to);
}, [currentView, recordEvent]);

---

Modify: apps/cli/src/features/review/hooks/use-triage.ts

Changes:
1. Import useSessionRecorder
2. Record events:
   - RUN_CREATED when triage starts (with reviewId)
   - Complete event handled by session recorder provider

---

Modify: apps/cli/src/features/review/components/review-screen.tsx (or equivalent)

Changes:
1. Import useSessionRecorder
2. Record events:
   - OPEN_ISSUE when user selects an issue
   - APPLY_PATCH when user applies a patch
   - IGNORE_ISSUE when user ignores an issue
   - TOGGLE_VIEW when user switches tabs
   - FILTER_CHANGED when user changes filters

Example:
const { recordEvent } = useSessionRecorder();

const handleSelectIssue = (issueId: string) => {
  recordEvent('OPEN_ISSUE', { reviewId, issueId });
  setSelectedIssueId(issueId);
};

const handleApplyPatch = async (issueId: string) => {
  const result = await applyPatch(issueId);
  recordEvent('APPLY_PATCH', { reviewId, issueId, success: result.ok });
};

const handleIgnoreIssue = (issueId: string) => {
  recordEvent('IGNORE_ISSUE', { reviewId, issueId });
  markAsIgnored(issueId);
};

Steps:
1. Read existing app.tsx
2. Add provider wrapper
3. Update navigation hook
4. Update triage hook
5. Update review components
6. Run: npm run type-check
7. Manual test: check ~/.stargazer/sessions/*.jsonl after using app

Output: Session recording integrated into app
```

---

## Validation Checklist

After completing all agents:

- [ ] `npm run type-check` passes
- [ ] `npx vitest run packages/core/src/storage/session-events.test.ts` passes
- [ ] Manual test: Start app, navigate, open issue, apply patch
- [ ] Check `~/.stargazer/sessions/*.jsonl` has events with correct format:
  ```jsonl
  {"ts":"2025-01-25T12:00:00.000Z","type":"RUN_CREATED","payload":{"projectId":"abc123"}}
  {"ts":"2025-01-25T12:00:05.000Z","type":"NAVIGATE","payload":{"from":"home","to":"review"}}
  {"ts":"2025-01-25T12:00:10.000Z","type":"OPEN_ISSUE","payload":{"reviewId":"xyz","issueId":"issue-1"}}
  ```
