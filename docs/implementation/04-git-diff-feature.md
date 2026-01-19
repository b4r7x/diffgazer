# Git Diff Feature

## Overview

The Git Diff feature provides a complete vertical slice for viewing staged and unstaged changes in a git repository. It follows the same architecture pattern as other features: shared schema definitions validated at runtime, a server-side service and route, and a CLI hook with display component.

## Location

| Layer | Path |
|-------|------|
| Schema | `packages/schemas/src/git.ts` |
| Service | `apps/server/src/services/git.ts` |
| Route | `apps/server/src/api/routes/git.ts` |
| Hook | `apps/cli/src/hooks/use-git-diff.ts` |
| Component | `apps/cli/src/components/git-diff-display.tsx` |
| App Integration | `apps/cli/src/app/app.tsx` |
| Error Utility | `apps/cli/src/lib/error.ts` |

## Architecture Flow

```
+------------------+
|    TUI (Ink)     |
|  [d] Git Diff    |
+--------+---------+
         |
         v
+------------------+
|   useGitDiff()   |
|  React Hook      |
+--------+---------+
         |
         | fetch(staged?)
         v
+------------------+
|  HTTP Request    |
|  GET /git/diff   |
+--------+---------+
         |
         v
+------------------+
|  git.ts Route    |
|  Hono Handler    |
+--------+---------+
         |
         v
+------------------+
|  GitService      |
|  getDiff()       |
+--------+---------+
         |
         | execFile("git", ["diff", ...])
         v
+------------------+
|  Git CLI         |
+------------------+
         |
         v
+------------------+
| GitDiffResponse  |
|  Zod Validation  |
+--------+---------+
         |
         v
+------------------+
| GitDiffDisplay   |
|  Colored Output  |
+------------------+
```

## Schema Definitions

The shared schema package defines the request/response types for git diff operations.

### GitDiffSchema

Represents the successful diff data:

```typescript
export const GitDiffSchema = z.object({
  diff: z.string(),
  staged: z.boolean(),
});
export type GitDiff = z.infer<typeof GitDiffSchema>;
```

| Field | Type | Description |
|-------|------|-------------|
| `diff` | `string` | Raw diff output from git |
| `staged` | `boolean` | Whether this is a staged diff |

### GitDiffResponseSchema

Discriminated union for success/error responses:

```typescript
export const GitDiffResponseSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), data: GitDiffSchema }),
  z.object({ success: z.literal(false), error: GitErrorSchema }),
]);
export type GitDiffResponse = z.infer<typeof GitDiffResponseSchema>;
```

### GitErrorSchema

Shared error schema used across git operations:

```typescript
export const GIT_ERROR_CODES = [
  "NOT_GIT_REPO",
  "GIT_NOT_FOUND",
  "COMMAND_FAILED",
  "INVALID_PATH",
  "INTERNAL_ERROR",
  "NOT_FOUND",
  "UNKNOWN",
] as const;

export const GitErrorSchema = z.object({
  message: z.string(),
  code: GitErrorCodeSchema,
  details: z.string().optional(),
});
export type GitError = z.infer<typeof GitErrorSchema>;
```

## Server Implementation

### Service Layer

**Location:** `apps/server/src/services/git.ts`

The `createGitService` factory returns a service object with a `getDiff` method:

```typescript
async function getDiff(staged = false): Promise<string> {
  const args = staged ? ["diff", "--cached"] : ["diff"];
  const { stdout } = await execFileAsync("git", args, { cwd, timeout, maxBuffer: 5 * 1024 * 1024 });
  return stdout;
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `staged` | `boolean` | `false` | If true, shows staged changes (`--cached`) |

**Configuration:**

| Option | Default | Description |
|--------|---------|-------------|
| `cwd` | `process.cwd()` | Working directory for git commands |
| `timeout` | `10000` | Command timeout in milliseconds |
| `maxBuffer` | `5 MB` | Maximum buffer size for diff output |

### Route Layer

**Location:** `apps/server/src/api/routes/git.ts`

The route handler validates the path, checks for git availability, and returns the diff:

```typescript
git.get("/diff", async (c) => {
  const result = await getGitService(c, c.req.query("path"));
  if (result instanceof Response) return result;

  const staged = c.req.query("staged") === "true";

  try {
    const status = await result.getStatus();
    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", "NOT_GIT_REPO", 400);
    }

    const diff = await result.getDiff(staged);
    return successResponse(c, { diff, staged });
  } catch (error) {
    console.error("Git diff error:", error);
    return errorResponse(c, "Failed to retrieve git diff", "COMMAND_FAILED", 500);
  }
});
```

**Path Validation:**

The route uses `getGitService()` which validates paths to prevent directory traversal:

```typescript
function isValidRelativePath(path: string): boolean {
  const startsWithSlash = path.startsWith("/") || path.startsWith("\\");
  const hasDriveLetter = /^[a-zA-Z]:/.test(path);
  const hasTraversal = path.includes("..");
  const hasNullByte = path.includes("\x00");
  return !startsWithSlash && !hasDriveLetter && !hasTraversal && !hasNullByte;
}
```

## API Endpoint

| Method | Path | Query Parameters | Response |
|--------|------|------------------|----------|
| GET | `/git/diff` | `path` (optional), `staged` (optional) | `GitDiffResponse` |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | Current working directory | Relative path to repository |
| `staged` | `string` | `"false"` | Set to `"true"` for staged changes |

### Response Format

**Success (200):**

```json
{
  "success": true,
  "data": {
    "diff": "diff --git a/file.ts b/file.ts\nindex abc123..def456 100644\n...",
    "staged": false
  }
}
```

**Error (400/500):**

```json
{
  "success": false,
  "error": {
    "message": "Not a git repository",
    "code": "NOT_GIT_REPO"
  }
}
```

## CLI Implementation

### Hook: useGitDiff

**Location:** `apps/cli/src/hooks/use-git-diff.ts`

The hook manages the fetch state machine and provides methods for fetching and resetting:

```typescript
export type GitDiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: GitDiff }
  | { status: "error"; error: GitError };

export function useGitDiff(baseUrl: string) {
  const [state, setState] = useState<GitDiffState>({ status: "idle" });

  async function fetchDiff(staged = false) {
    setState({ status: "loading" });

    try {
      const url = `${baseUrl}/git/diff${staged ? "?staged=true" : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        setState({ status: "error", error: makeError(`HTTP ${res.status}`) });
        return;
      }

      const json = await res.json().catch(() => null);
      if (json === null) {
        setState({ status: "error", error: makeError("Invalid JSON response") });
        return;
      }

      const parsed = GitDiffResponseSchema.safeParse(json);
      if (!parsed.success) {
        setState({ status: "error", error: makeError("Invalid response") });
        return;
      }

      if (parsed.data.success) {
        setState({ status: "success", data: parsed.data.data });
      } else {
        setState({ status: "error", error: parsed.data.error });
      }
    } catch (e) {
      setState({ status: "error", error: makeError(String(e)) });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { state, fetch: fetchDiff, reset };
}
```

**Return Value:**

| Property | Type | Description |
|----------|------|-------------|
| `state` | `GitDiffState` | Current state of the diff request |
| `fetch` | `(staged?: boolean) => Promise<void>` | Fetches diff from server |
| `reset` | `() => void` | Resets state to idle |

### Component: GitDiffDisplay

**Location:** `apps/cli/src/components/git-diff-display.tsx`

The component renders the diff with syntax highlighting:

```typescript
function DiffLine({ line }: { line: string }) {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return <Text color="green">{line}</Text>;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return <Text color="red">{line}</Text>;
  }
  if (line.startsWith("@@")) {
    return <Text color="cyan">{line}</Text>;
  }
  if (line.startsWith("diff ") || line.startsWith("index ")) {
    return <Text bold>{line}</Text>;
  }
  return <Text>{line}</Text>;
}

export function GitDiffDisplay({ state, staged }: { state: GitDiffState; staged: boolean }) {
  if (state.status === "loading") {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Loading diff...</Text>
      </Box>
    );
  }

  if (state.status === "error") {
    return <Text color="red">Error: {state.error.message}</Text>;
  }

  if (state.status !== "success") {
    return <Text dimColor>Press 'r' to load</Text>;
  }

  const { data } = state;
  const isEmpty = data.diff.trim().length === 0;

  if (isEmpty) {
    return <Text color="green">No {staged ? "staged" : "unstaged"} changes</Text>;
  }

  const lines = data.diff.split("\n");

  return (
    <Box flexDirection="column">
      <Text bold color={staged ? "green" : "yellow"}>
        {staged ? "Staged" : "Unstaged"} Changes
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {lines.slice(0, 50).map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
        {lines.length > 50 && (
          <Text dimColor>... ({lines.length - 50} more lines)</Text>
        )}
      </Box>
    </Box>
  );
}
```

**Color Scheme:**

| Line Type | Color | Example |
|-----------|-------|---------|
| Added lines | Green | `+const x = 1;` |
| Removed lines | Red | `-const x = 0;` |
| Hunk headers | Cyan | `@@ -1,3 +1,4 @@` |
| File headers | Bold | `diff --git a/file.ts b/file.ts` |
| Context lines | Default | ` unchanged line` |

**Display Limits:**

- Maximum 50 lines displayed by default
- Shows count of remaining lines if truncated

## Keyboard Bindings

### Main View

| Key | Action | Description |
|-----|--------|-------------|
| `d` | Open Git Diff | Switches to diff view and fetches unstaged changes |
| `g` | Open Git Status | Switches to status view |
| `q` | Quit | Exits the application |

### Git Diff View

| Key | Action | Description |
|-----|--------|-------------|
| `s` | Toggle Staged | Switches between staged and unstaged diff |
| `r` | Refresh | Re-fetches the current diff |
| `b` | Back | Returns to main view |
| `Escape` | Back | Returns to main view |
| `q` | Quit | Exits the application |

**App Integration:**

```typescript
if (view === "git-diff") {
  if (input === "r") {
    void gitDiff.fetch(diffStaged);
  }
  if (input === "s") {
    const next = !diffStaged;
    setDiffStaged(next);
    void gitDiff.fetch(next);
  }
  if (input === "b" || key.escape) {
    setView("main");
    gitDiff.reset();
  }
}
```

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_GIT_REPO` | 400 | Directory is not a git repository |
| `GIT_NOT_FOUND` | 500 | Git executable not found on system |
| `COMMAND_FAILED` | 500 | Git command execution failed |
| `INVALID_PATH` | 400 | Path validation failed (traversal attempt) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `NOT_FOUND` | 404 | Resource not found |
| `UNKNOWN` | - | Client-side error (network, parsing) |

### Error Utility

**Location:** `apps/cli/src/lib/error.ts`

The `makeError` function creates GitError objects for client-side errors:

```typescript
import type { GitError } from "@repo/schemas/git";

export function makeError(message: string): GitError {
  return { message, code: "UNKNOWN" };
}
```

### Error Flow

```
Server Error         Client Error
     |                    |
     v                    v
errorResponse()      makeError()
     |                    |
     v                    v
GitErrorSchema       GitError
     |                    |
     +--------+-----------+
              |
              v
      GitDiffState.error
              |
              v
   <Text color="red">Error: {message}</Text>
```

## Usage

### TUI Mode

1. Start the CLI:
   ```bash
   stargazer run
   ```

2. Press `d` to open the git diff view

3. View unstaged changes with syntax highlighting

4. Press `s` to toggle between staged and unstaged changes

5. Press `r` to refresh the diff

6. Press `b` or `Escape` to return to the main menu

### Programmatic Usage

**Fetch unstaged diff:**

```bash
curl http://localhost:3000/git/diff
```

**Fetch staged diff:**

```bash
curl "http://localhost:3000/git/diff?staged=true"
```

**Fetch diff for specific path:**

```bash
curl "http://localhost:3000/git/diff?path=packages/schemas"
```

### Response Examples

**Unstaged changes present:**

```json
{
  "success": true,
  "data": {
    "diff": "diff --git a/src/index.ts b/src/index.ts\nindex 1234567..abcdefg 100644\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n import { foo } from './foo';\n+import { bar } from './bar';\n \n export { foo };",
    "staged": false
  }
}
```

**No changes:**

```json
{
  "success": true,
  "data": {
    "diff": "",
    "staged": false
  }
}
```

**Not a git repository:**

```json
{
  "success": false,
  "error": {
    "message": "Not a git repository",
    "code": "NOT_GIT_REPO"
  }
}
```
