# Server Application

Hono HTTP server providing the API for CLI communication. Binds to localhost only for security.

## Quick Start

```bash
# Start via CLI (recommended)
stargazer serve

# Or programmatically
import { createServer } from "@repo/server";
const app = createServer();
```

## Architecture

```
apps/server/src/
├── index.ts              # Entry point
├── app.ts                # Hono app factory
├── api/
│   └── routes/
│       ├── index.ts      # Route aggregation
│       ├── health.ts     # Health check
│       ├── review.ts     # Review endpoints
│       ├── sessions.ts   # Session management
│       ├── config.ts     # Configuration
│       ├── git.ts        # Git operations
│       └── chat.ts       # Chat endpoints
├── config/               # Configuration
├── lib/                  # Utilities
│   ├── response.ts       # Response helpers
│   ├── validation.ts     # Request validation
│   ├── sse-helpers.ts    # SSE utilities
│   └── ai-client.ts      # AI client factory
└── services/
    ├── review.ts         # Review business logic
    ├── review-orchestrator.ts  # Chunked reviews
    ├── review-aggregator.ts    # Result aggregation
    ├── git.ts            # Git operations
    └── chat.ts           # Chat logic
```

## API Endpoints

### Health

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-24T10:00:00.000Z"
}
```

### Review

#### Stream Review

```
GET /review/stream?staged=true
```

SSE stream of review events.

Query Parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `staged` | boolean | `true` | Review staged or unstaged changes |

Events:
```
event: chunk
data: {"type":"chunk","content":"Analyzing..."}

event: complete
data: {"type":"complete","result":{"summary":"...","issues":[...],"overallScore":8}}

event: error
data: {"type":"error","error":{"message":"No changes","code":"NO_DIFF"}}
```

### Sessions

#### List Sessions

```
GET /sessions
```

Response:
```json
{
  "sessions": [
    {
      "id": "abc123",
      "projectPath": "/path/to/project",
      "createdAt": "2024-01-24T10:00:00.000Z",
      "updatedAt": "2024-01-24T10:00:00.000Z"
    }
  ]
}
```

#### Create Session

```
POST /sessions
Content-Type: application/json

{
  "projectPath": "/path/to/project"
}
```

#### Get Session

```
GET /sessions/:id
```

#### Delete Session

```
DELETE /sessions/:id
```

### Configuration

#### Check Configuration

```
GET /config/check
```

Response:
```json
{
  "configured": true,
  "config": {
    "provider": "gemini",
    "model": "gemini-2.5-flash"
  }
}
```

#### Get Current Config

```
GET /config
```

#### Save Configuration

```
POST /config
Content-Type: application/json

{
  "provider": "gemini",
  "apiKey": "...",
  "model": "gemini-2.5-flash"
}
```

#### Delete Configuration

```
DELETE /config
```

### Git

#### Get Status

```
GET /git/status
```

Response:
```json
{
  "branch": "main",
  "files": {
    "staged": ["src/index.ts"],
    "unstaged": ["README.md"]
  }
}
```

#### Get Diff

```
GET /git/diff?staged=true
```

### Reviews History

#### List Reviews

```
GET /reviews
```

#### Get Review

```
GET /reviews/:id
```

## Security

### Localhost Binding

Server binds to `127.0.0.1` only:

```typescript
serve({
  fetch: app.fetch,
  hostname: "127.0.0.1",
  port: 3000,
});
```

### Host Header Validation

Requests must have localhost Host header:

```typescript
app.use("*", async (c, next) => {
  const host = c.req.header("host")?.split(":")[0];
  if (host && !["localhost", "127.0.0.1"].includes(host)) {
    return c.text("Forbidden", 403);
  }
  await next();
});
```

### CORS

Only localhost origins allowed:

```typescript
cors({
  origin: (origin) => {
    if (!origin) return origin;
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return origin;
    }
    return "";
  },
  credentials: true,
});
```

### Security Headers

```typescript
c.header("X-Frame-Options", "DENY");
c.header("X-Content-Type-Options", "nosniff");
```

## Services

### ReviewService

Core review logic.

```typescript
import { streamReviewToSSE, reviewDiff } from "@/services/review";

// Stream review via SSE
await streamReviewToSSE(aiClient, staged, sseWriter);

// Get review result
await reviewDiff(aiClient, staged, callbacks);
```

### Review Orchestrator

Handles large diffs by reviewing files in batches.

```typescript
import { reviewDiffChunked } from "@/services/review-orchestrator";

await reviewDiffChunked(aiClient, staged, {
  onFileStart: (file, index, total) => {},
  onFileComplete: (file, result) => {},
  onFileError: (file, error) => {},
  onProgress: (completed, total) => {},
  onChunk: (chunk) => {},
  onComplete: (aggregatedResult) => {},
  onError: (error) => {},
});
```

### GitService

Git operations wrapper.

```typescript
import { createGitService } from "@/services/git";

const git = createGitService({ cwd: projectPath });
const status = await git.getStatus();
const diff = await git.getDiff(staged);
```

## Response Helpers

```typescript
import { successResponse, errorResponse } from "@/lib/response";

// Success response
return successResponse(c, data);
// { success: true, data: ... }

// Error response
return errorResponse(c, "Not found", ErrorCode.NOT_FOUND, 404);
// { success: false, error: { message: "Not found", code: "NOT_FOUND" } }
```

## SSE Helpers

```typescript
import { writeSSEChunk, writeSSEComplete, writeSSEError } from "@/lib/sse-helpers";

await writeSSEChunk(stream, "Processing...");
await writeSSEComplete(stream, { result: reviewResult });
await writeSSEError(stream, "Failed", ErrorCode.AI_ERROR);
```

## Error Handling

Global error handler:

```typescript
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return errorResponse(c, "Internal server error", ErrorCode.INTERNAL_ERROR, 500);
});
```

## Testing

```bash
# Run server tests
npx vitest run apps/server

# Test endpoints manually
curl http://localhost:3000/health
curl -N http://localhost:3000/review/stream?staged=true
```

## Cross-References

- [Apps: CLI](./cli.md) - CLI that uses this server
- [Features: Review Flow](../features/review-flow.md) - Review implementation
- [Architecture: Data Flow](../architecture/data-flow.md) - Request flows
