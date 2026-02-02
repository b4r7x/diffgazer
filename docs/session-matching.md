# Session Matching

## Overview

Session matching allows Stargazer to reuse in-progress or recently-completed code reviews when the user refreshes the browser or reconnects. This prevents duplicate AI analysis when the underlying code hasn't changed, improving both user experience and API efficiency.

When a client requests a review, the server checks if an active session already exists for the same project state. If found, the server replays existing events and subscribes the client to any new events, rather than starting a fresh review.

## The Problem

Prior to adding `statusHash`, session matching only used these criteria:
- `projectPath` - the directory being reviewed
- `headCommit` - the current HEAD commit SHA
- `staged` - whether reviewing staged or unstaged changes

This caused a bug: when reviewing **unstaged** changes, the user would see stale results if they edited more files after starting a review. Since editing files doesn't create a new commit, `headCommit` remained the same, and the old session would be incorrectly reused.

**Example scenario:**
1. User runs "review unstaged" - gets results for files A and B
2. User edits file C
3. User refreshes browser
4. Session matches (same headCommit), replays old results
5. User never sees file C reviewed

## The Solution

Added `statusHash` to session matching criteria. This hash changes whenever the working directory state changes (new files, modified files, staged/unstaged changes).

**How statusHash is computed:**

1. Run `git status --porcelain`
2. Split output into lines, filter empty lines
3. Sort lines alphabetically (for determinism)
4. If no lines, return empty string `""`
5. Otherwise, compute SHA256 hash of joined lines
6. Take first 16 characters of hex digest

```typescript
// From apps/server/src/services/git.ts:204-216
async function getStatusHash(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd, timeout });
  const lines = stdout.split("\n").filter(Boolean).sort();
  if (lines.length === 0) {
    return "";
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}
```

## Technical Details

### ActiveSession Interface

```typescript
// From apps/server/src/storage/active-sessions.ts:3-14
interface ActiveSession {
  reviewId: string;
  projectPath: string;
  headCommit: string;
  statusHash: string;
  staged: boolean;
  startedAt: Date;
  events: FullTriageStreamEvent[];
  isComplete: boolean;
  isReady: boolean;
  subscribers: Set<(event: FullTriageStreamEvent) => void>;
}
```

### Session Matching Criteria

A session matches if ALL of these conditions are true:

| Field | Description |
|-------|-------------|
| `projectPath` | Same directory being reviewed |
| `headCommit` | Same HEAD commit SHA |
| `statusHash` | Same working directory state hash |
| `staged` | Same review mode (staged vs unstaged) |
| `!isComplete` | Session is still active |
| `isReady` | Session has emitted initial events |

```typescript
// From apps/server/src/storage/active-sessions.ts:84-103
export function getActiveSessionForProject(
  projectPath: string,
  headCommit: string,
  statusHash: string,
  staged: boolean
): ActiveSession | undefined {
  for (const session of activeSessions.values()) {
    if (
      session.projectPath === projectPath &&
      session.headCommit === headCommit &&
      session.statusHash === statusHash &&
      session.staged === staged &&
      !session.isComplete &&
      session.isReady
    ) {
      return session;
    }
  }
  return undefined;
}
```

### Session Creation Flow

In `triage.ts`, sessions are created with the current git state:

```typescript
// From apps/server/src/services/triage.ts:74-84
headCommit = await gitService.getHeadCommit();
statusHash = await gitService.getStatusHash();

// From apps/server/src/services/triage.ts:129-131
const reviewId = randomUUID();
createSession(reviewId, projectPath, headCommit, statusHash, staged);
```

## Code Locations

| File | Line | Purpose |
|------|------|---------|
| `apps/server/src/services/git.ts` | 204-216 | `getStatusHash()` implementation |
| `apps/server/src/storage/active-sessions.ts` | 3-14 | `ActiveSession` interface |
| `apps/server/src/storage/active-sessions.ts` | 18-39 | `createSession()` function |
| `apps/server/src/storage/active-sessions.ts` | 84-103 | `getActiveSessionForProject()` matching logic |
| `apps/server/src/services/triage.ts` | 74-84 | Git state retrieval |
| `apps/server/src/services/triage.ts` | 87-93 | Session lookup with all criteria |
| `apps/server/src/services/triage.ts` | 129-131 | New session creation |

## Scenarios

### F5 Refresh (No Changes)

**User action:** Refreshes browser while review is in progress or just completed

**What happens:**
- `headCommit`: unchanged
- `statusHash`: unchanged
- `staged`: unchanged
- **Result:** Session matches, events are replayed

### Edit File, Review Again

**User action:** Edits a file, then requests a new review

**What happens:**
- `headCommit`: unchanged (no commit made)
- `statusHash`: **changed** (git status output differs)
- **Result:** No session match, new review starts

### Commit Changes

**User action:** Commits changes, then requests a review

**What happens:**
- `headCommit`: **changed** (new commit SHA)
- `statusHash`: changed (staged files cleared)
- **Result:** No session match, new review starts

### Stage/Unstage Files

**User action:** Runs `git add` or `git reset`, then requests a review

**What happens:**
- `headCommit`: unchanged
- `statusHash`: **changed** (file status codes change)
- **Result:** No session match, new review starts

### Switch Between Staged/Unstaged

**User action:** Reviews staged changes, then reviews unstaged changes

**What happens:**
- `headCommit`: unchanged
- `statusHash`: unchanged
- `staged`: **changed** (true vs false)
- **Result:** No session match, new review starts
