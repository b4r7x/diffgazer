# AI Review Feature

## Overview

The AI Review feature provides AI-powered code review of git diffs using streaming responses. It analyzes staged or unstaged changes and returns structured feedback including issues categorized by severity and type. The feature uses Google's Gemini AI model via the `@repo/core` package and streams results to the CLI using Server-Sent Events (SSE).

## Location

| Layer | Path |
|-------|------|
| Core Package | `packages/core/src/` |
| AI Client Factory | `packages/core/src/ai/client.ts` |
| AI Types | `packages/core/src/ai/types.ts` |
| AI Errors | `packages/core/src/ai/errors.ts` |
| Gemini Provider | `packages/core/src/ai/providers/gemini.ts` |
| Result Type | `packages/core/src/result.ts` |
| Schema | `packages/schemas/src/review.ts` |
| Service | `apps/server/src/services/review.ts` |
| Route | `apps/server/src/api/routes/review.ts` |
| Hook | `apps/cli/src/hooks/use-review.ts` |
| Component | `apps/cli/src/components/review-display.tsx` |
| App Integration | `apps/cli/src/app/app.tsx` |

## Architecture Flow

```
+------------------+
|    TUI (Ink)     |
|  [r] AI Review   |
+--------+---------+
         |
         v
+------------------+
|   useReview()    |
|  React Hook      |
+--------+---------+
         |
         | fetch (SSE stream)
         v
+------------------+
|  HTTP Request    |
| GET /review/stream|
+--------+---------+
         |
         v
+------------------+
|  review.ts Route |
|  Hono Handler    |
+--------+---------+
         |
         v
+------------------+
|  createAIClient()|
|  @repo/core/ai   |
+--------+---------+
         |
         v
+------------------+
| ReviewService    |
| reviewStream()   |
+--------+---------+
         |
         | getDiff() + AI prompt
         v
+------------------+
|  GitService      |
|  getDiff()       |
+--------+---------+
         |
         v
+------------------+
|  Gemini API      |
| generateStream() |
+--------+---------+
         |
         | SSE chunks
         v
+------------------+
| ReviewResult     |
| Zod Validation   |
+--------+---------+
         |
         v
+------------------+
| ReviewDisplay    |
| Colored Output   |
+------------------+
```

## Core Package (`@repo/core`)

The core package provides foundational utilities used across the monorepo, including the AI client abstraction and Result type.

### Package Exports

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./ai": { "types": "./dist/ai/index.d.ts", "import": "./dist/ai/index.js" }
  }
}
```

### Result Type

**Location:** `packages/core/src/result.ts`

A minimal Result type for explicit error handling without exceptions:

```typescript
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

| Function | Description |
|----------|-------------|
| `ok(value)` | Creates a success result with the given value |
| `err(error)` | Creates an error result with the given error |

**Usage Example:**

```typescript
import { ok, err, type Result } from "@repo/core";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err("Division by zero");
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // 5
} else {
  console.error(result.error);
}
```

### AI Client Types

**Location:** `packages/core/src/ai/types.ts`

```typescript
export type AIProvider = "gemini" | "anthropic" | "openai";

export interface StreamCallbacks {
  onChunk: (chunk: string) => void | Promise<void>;
  onComplete: (fullContent: string) => void | Promise<void>;
  onError: (error: Error) => void | Promise<void>;
}

export interface AIClientConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIClient {
  readonly provider: AIProvider;
  generate<T extends z.ZodType>(prompt: string, schema: T): Promise<Result<z.infer<T>, AIError>>;
  generateStream(prompt: string, callbacks: StreamCallbacks): Promise<void>;
}
```

| Type | Description |
|------|-------------|
| `AIProvider` | Supported AI providers (currently only Gemini implemented) |
| `StreamCallbacks` | Callbacks for streaming responses (async-compatible) |
| `AIClientConfig` | Configuration options for AI client |
| `AIClient` | Interface for AI operations |

### AI Error Types

**Location:** `packages/core/src/ai/errors.ts`

```typescript
export const AI_ERROR_CODES = [
  "API_KEY_MISSING",
  "API_KEY_INVALID",
  "RATE_LIMITED",
  "MODEL_ERROR",
  "NETWORK_ERROR",
  "PARSE_ERROR",
  "STREAM_ERROR",
  "UNSUPPORTED_PROVIDER",
] as const;

export type AIErrorCode = typeof AI_ERROR_CODES[number];

export interface AIError {
  code: AIErrorCode;
  message: string;
  details?: string;
}

export function createAIError(code: AIErrorCode, message: string, details?: string): AIError
```

| Error Code | Description |
|------------|-------------|
| `API_KEY_MISSING` | No API key provided |
| `API_KEY_INVALID` | API key rejected by provider |
| `RATE_LIMITED` | Rate limit exceeded |
| `MODEL_ERROR` | Model returned an error |
| `NETWORK_ERROR` | Network request failed |
| `PARSE_ERROR` | Failed to parse AI response |
| `STREAM_ERROR` | Error during streaming |
| `UNSUPPORTED_PROVIDER` | Provider not implemented |

### AI Client Factory

**Location:** `packages/core/src/ai/client.ts`

```typescript
export function createAIClient(provider: AIProvider, config: AIClientConfig): Result<AIClient, AIError>
```

Creates an AI client for the specified provider. Currently supports:

- `gemini` - Google Gemini (implemented)
- `anthropic` - Anthropic Claude (TODO)
- `openai` - OpenAI GPT (TODO)

Returns a `Result` type to handle initialization errors (e.g., missing API key).

### Gemini Provider

**Location:** `packages/core/src/ai/providers/gemini.ts`

```typescript
export function createGeminiClient(config: AIClientConfig): Result<AIClient, AIError>
```

Implementation details:

| Setting | Default | Description |
|---------|---------|-------------|
| `model` | `gemini-2.0-flash` | Model identifier |
| `temperature` | `0.7` | Response randomness |
| `maxTokens` | `4096` | Maximum output tokens |
| `responseMimeType` | `application/json` | For structured responses |

**Streaming Implementation:**

```typescript
async generateStream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
  const stream = await client.models.generateContentStream({
    model,
    contents: prompt,
    config: { temperature, maxOutputTokens },
  });

  let fullContent = "";
  for await (const chunk of stream) {
    const text = chunk.text ?? "";
    if (text) {
      fullContent += text;
      callbacks.onChunk(text);
    }
  }
  callbacks.onComplete(fullContent);
}
```

**Error Handling:**

The provider detects specific error conditions and maps them to appropriate error codes:

- HTTP 401 or "API key" in message -> `API_KEY_INVALID`
- HTTP 429 or "rate" in message -> `RATE_LIMITED`
- Other errors -> `MODEL_ERROR`

## Schema Definitions

**Location:** `packages/schemas/src/review.ts`

### Severity and Category Enums

```typescript
export const REVIEW_SEVERITY = ["critical", "warning", "suggestion", "nitpick"] as const;
export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITY);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export const REVIEW_CATEGORY = ["security", "performance", "style", "logic", "documentation", "best-practice"] as const;
export const ReviewCategorySchema = z.enum(REVIEW_CATEGORY);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;
```

| Severity | Description |
|----------|-------------|
| `critical` | Must be fixed before merge |
| `warning` | Should be addressed |
| `suggestion` | Improvement opportunity |
| `nitpick` | Minor style preference |

| Category | Description |
|----------|-------------|
| `security` | Security vulnerabilities |
| `performance` | Performance issues |
| `style` | Code style/formatting |
| `logic` | Logic errors or bugs |
| `documentation` | Missing or incorrect docs |
| `best-practice` | Coding best practices |

### ReviewIssueSchema

```typescript
export const ReviewIssueSchema = z.object({
  severity: ReviewSeveritySchema,
  category: ReviewCategorySchema,
  file: z.string().nullable(),
  line: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().nullable(),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;
```

| Field | Type | Description |
|-------|------|-------------|
| `severity` | `ReviewSeverity` | Issue severity level |
| `category` | `ReviewCategory` | Issue category |
| `file` | `string \| null` | File path where issue exists |
| `line` | `number \| null` | Line number (if applicable) |
| `title` | `string` | Short issue title |
| `description` | `string` | Detailed description |
| `suggestion` | `string \| null` | Suggested fix |

### ReviewResultSchema

```typescript
export const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  overallScore: z.number().min(0).max(10).optional(),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
```

| Field | Type | Description |
|-------|------|-------------|
| `summary` | `string` | Overall review summary |
| `issues` | `ReviewIssue[]` | Array of identified issues |
| `overallScore` | `number \| undefined` | Code quality score (0-10) |

### ReviewErrorSchema

```typescript
export const REVIEW_ERROR_CODES = ["NO_DIFF", "AI_ERROR", "API_KEY_MISSING", "RATE_LIMITED", "INTERNAL_ERROR"] as const;
export const ReviewErrorCodeSchema = z.enum(REVIEW_ERROR_CODES);
export type ReviewErrorCode = z.infer<typeof ReviewErrorCodeSchema>;

export const ReviewErrorSchema = z.object({
  message: z.string(),
  code: ReviewErrorCodeSchema,
});
export type ReviewError = z.infer<typeof ReviewErrorSchema>;
```

| Error Code | Description |
|------------|-------------|
| `NO_DIFF` | No changes to review |
| `AI_ERROR` | AI provider error |
| `API_KEY_MISSING` | GEMINI_API_KEY not set |
| `RATE_LIMITED` | Rate limit exceeded |
| `INTERNAL_ERROR` | Unexpected server error |

### ReviewStreamEventSchema

```typescript
export const ReviewStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({ type: z.literal("complete"), result: ReviewResultSchema }),
  z.object({ type: z.literal("error"), error: ReviewErrorSchema }),
]);
export type ReviewStreamEvent = z.infer<typeof ReviewStreamEventSchema>;
```

| Event Type | Payload | Description |
|------------|---------|-------------|
| `chunk` | `{ content: string }` | Partial AI response text |
| `complete` | `{ result: ReviewResult }` | Final parsed review result |
| `error` | `{ error: ReviewError }` | Error during review |

## Server Implementation

### Service Layer

**Location:** `apps/server/src/services/review.ts`

```typescript
export function createReviewService(config: { cwd?: string; aiClient: AIClient })
```

The service combines the Git service (for diff retrieval) with the AI client (for analysis):

```typescript
const CODE_REVIEW_PROMPT = `You are an expert code reviewer. Analyze the following git diff and provide a structured code review.

Git Diff:
\`\`\`diff
{diff}
\`\`\`

Respond with JSON only: { "summary": "...", "issues": [...], "overallScore": 0-10 }
Each issue: { "severity": "critical|warning|suggestion|nitpick", "category": "security|performance|style|logic|documentation|best-practice", "file": "path or null", "line": number or null, "title": "...", "description": "...", "suggestion": "fix or null" }`;
```

**reviewStream Method:**

```typescript
async function reviewStream(staged: boolean, callbacks: StreamCallbacks): Promise<void> {
  // 1. Get git diff
  const diff = await gitService.getDiff(staged);

  // 2. Check for empty diff
  if (!diff.trim()) {
    callbacks.onError(new Error(`No ${staged ? "staged" : "unstaged"} changes to review`));
    return;
  }

  // 3. Build prompt and stream AI response
  const prompt = CODE_REVIEW_PROMPT.replace("{diff}", diff);
  await aiClient.generateStream(prompt, callbacks);
}
```

### Route Layer

**Location:** `apps/server/src/api/routes/review.ts`

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createAIClient } from "@repo/core/ai";
import { createReviewService } from "../../services/review.js";
import { ReviewResultSchema } from "@repo/schemas/review";

const review = new Hono();

review.get("/stream", async (c) => {
  // 1. Validate API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, error: { message: "GEMINI_API_KEY not set", code: "API_KEY_MISSING" } }, 500);
  }

  // 2. Create AI client
  const clientResult = createAIClient("gemini", { apiKey });
  if (!clientResult.ok) {
    return c.json({ success: false, error: { message: clientResult.error.message, code: "AI_ERROR" } }, 500);
  }

  // 3. Parse query parameter
  const staged = c.req.query("staged") !== "false";
  const reviewService = createReviewService({ aiClient: clientResult.value });

  // 4. Stream SSE response
  return streamSSE(c, async (stream) => {
    await reviewService.reviewStream(staged, {
      onChunk: async (chunk) => {
        await stream.writeSSE({ event: "chunk", data: JSON.stringify({ type: "chunk", content: chunk }) });
      },
      onComplete: async (content) => {
        // Parse and validate JSON response
        const parsed = JSON.parse(content);
        const validated = ReviewResultSchema.safeParse(parsed);
        const result = validated.success ? validated.data : { summary: content, issues: [] };
        await stream.writeSSE({ event: "complete", data: JSON.stringify({ type: "complete", result }) });
      },
      onError: async (error) => {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", error: { message: error.message, code: "AI_ERROR" } }) });
      },
    });
  });
});
```

## SSE Streaming Details

### Protocol

The server uses Server-Sent Events (SSE) with `hono/streaming` for real-time updates:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Format

Each event follows the SSE specification:

```
event: <event-type>
data: <json-payload>

```

**Chunk Event:**

```
event: chunk
data: {"type":"chunk","content":"The code looks good overall..."}

```

**Complete Event:**

```
event: complete
data: {"type":"complete","result":{"summary":"...","issues":[...],"overallScore":8}}

```

**Error Event:**

```
event: error
data: {"type":"error","error":{"message":"No staged changes to review","code":"AI_ERROR"}}

```

### Client-Side Parsing

The CLI hook parses SSE events using a buffer-based approach:

```typescript
const decoder = new TextDecoder();
let buffer = "", streamedContent = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6)) as ReviewStreamEvent;
      // Handle event...
    }
  }
}
```

## API Endpoint

| Method | Path | Query Parameters | Response |
|--------|------|------------------|----------|
| GET | `/review/stream` | `staged` (optional) | SSE stream |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `staged` | `string` | `"true"` | Set to `"false"` for unstaged changes |

### Response Format

**SSE Stream (200):**

Streams events of type `chunk`, `complete`, or `error` as described above.

**Error (500 - before stream):**

```json
{
  "success": false,
  "error": {
    "message": "GEMINI_API_KEY not set",
    "code": "API_KEY_MISSING"
  }
}
```

## CLI Implementation

### Hook: useReview

**Location:** `apps/cli/src/hooks/use-review.ts`

```typescript
export type ReviewState =
  | { status: "idle" }
  | { status: "loading"; content: string }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };

export function useReview(baseUrl: string) {
  const [state, setState] = useState<ReviewState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const startReview = useCallback(async (staged = true) => {
    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState({ status: "loading", content: "" });

    // Fetch SSE stream and update state
    // ...
  }, [baseUrl]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, startReview, reset };
}
```

**State Machine:**

```
  [idle]
    |
    | startReview()
    v
[loading] -----> SSE chunks update content
    |
    +---> onComplete --> [success]
    |
    +---> onError -----> [error]
    |
    +---> abort -------> [idle] (via reset)
```

**Return Value:**

| Property | Type | Description |
|----------|------|-------------|
| `state` | `ReviewState` | Current state of the review request |
| `startReview` | `(staged?: boolean) => Promise<void>` | Initiates AI review |
| `reset` | `() => void` | Cancels and resets to idle |

**Key Features:**

- **Request Cancellation:** Uses `AbortController` to cancel in-flight requests
- **Streaming Updates:** Updates `content` field during loading for live preview
- **Error Handling:** Catches HTTP errors, JSON parse errors, and network errors

### Component: ReviewDisplay

**Location:** `apps/cli/src/components/review-display.tsx`

```typescript
const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: "red",
  warning: "yellow",
  suggestion: "blue",
  nitpick: "gray",
};

function IssueItem({ issue }: { issue: ReviewIssue }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={SEVERITY_COLORS[issue.severity]} bold>
        [{issue.severity}] {issue.title}
      </Text>
      {issue.file && (
        <Text dimColor>  File: {issue.file}{issue.line ? `:${issue.line}` : ""}</Text>
      )}
      <Text>  {issue.description}</Text>
      {issue.suggestion && <Text color="green">  Fix: {issue.suggestion}</Text>}
    </Box>
  );
}

export function ReviewDisplay({ state, staged }: { state: ReviewState; staged: boolean })
```

**Color Scheme:**

| Severity | Color | Purpose |
|----------|-------|---------|
| `critical` | Red | Must-fix issues |
| `warning` | Yellow | Should-fix issues |
| `suggestion` | Blue | Nice-to-have improvements |
| `nitpick` | Gray | Minor style preferences |
| Fix suggestion | Green | Recommended fix text |

**Display States:**

| State | Display |
|-------|---------|
| `idle` | "Press 'r' to start review" |
| `loading` | Spinner + "Reviewing..." + partial content preview |
| `error` | Red error message |
| `success` | Summary, score, and issue list |

**Loading State Preview:**

```typescript
if (state.status === "loading") {
  return (
    <Box flexDirection="column">
      <Box>
        <Spinner type="dots" />
        <Text> Reviewing {staged ? "staged" : "unstaged"} changes...</Text>
      </Box>
      {state.content && <Text dimColor>{state.content.slice(0, 200)}...</Text>}
    </Box>
  );
}
```

Shows first 200 characters of streaming response for user feedback.

## Keyboard Bindings

### Main View

| Key | Action | Description |
|-----|--------|-------------|
| `r` | Open AI Review | Switches to review view and starts review of staged changes |
| `g` | Open Git Status | Switches to status view |
| `d` | Open Git Diff | Switches to diff view |
| `q` | Quit | Exits the application |

### AI Review View

| Key | Action | Description |
|-----|--------|-------------|
| `s` | Toggle Staged | Switches between staged and unstaged review |
| `r` | Refresh | Re-runs the AI review |
| `b` | Back | Returns to main view |
| `Escape` | Back | Returns to main view |
| `q` | Quit | Exits the application |

**App Integration:**

```typescript
if (view === "review") {
  if (input === "r") {
    void review.startReview(reviewStaged);
  }
  if (input === "s") {
    const next = !reviewStaged;
    setReviewStaged(next);
    void review.startReview(next);
  }
  if (input === "b" || key.escape) {
    setView("main");
    review.reset();
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI requests |

## Usage

### TUI Mode

1. Set up environment:
   ```bash
   export GEMINI_API_KEY=your-api-key
   ```

2. Start the CLI:
   ```bash
   stargazer run
   ```

3. Stage some changes:
   ```bash
   git add -p
   ```

4. Press `r` to start AI review

5. View the streaming review with severity-colored issues

6. Press `s` to toggle between staged and unstaged review

7. Press `r` to refresh the review

8. Press `b` or `Escape` to return to the main menu

### Programmatic Usage

**Review staged changes:**

```bash
curl -N "http://localhost:3000/review/stream"
```

**Review unstaged changes:**

```bash
curl -N "http://localhost:3000/review/stream?staged=false"
```

Note: The `-N` flag disables buffering for proper SSE streaming.

### Response Examples

**Streaming chunks:**

```
event: chunk
data: {"type":"chunk","content":"Based on the provided git diff"}

event: chunk
data: {"type":"chunk","content":", I've identified the following issues:\n\n"}

event: complete
data: {"type":"complete","result":{"summary":"The code changes add a new utility function with minor issues.","issues":[{"severity":"warning","category":"security","file":"src/utils.ts","line":15,"title":"Potential SQL injection","description":"User input is concatenated directly into SQL query","suggestion":"Use parameterized queries instead"}],"overallScore":7}}
```

**No changes to review:**

```
event: error
data: {"type":"error","error":{"message":"No staged changes to review","code":"AI_ERROR"}}
```

**Missing API key (HTTP response before stream):**

```json
{
  "success": false,
  "error": {
    "message": "GEMINI_API_KEY not set",
    "code": "API_KEY_MISSING"
  }
}
```

## Error Handling

### Error Flow

```
Server Error              Client Error             AI Error
     |                         |                       |
     v                         v                       v
JSON response             AbortError check        SSE error event
(before stream)           (ignored)               (during stream)
     |                         |                       |
     v                         v                       v
setState(error)           No state change         setState(error)
     |                         |                       |
     +------------+------------+-----------+-----------+
                              |
                              v
                   <Text color="red">Error: {message}</Text>
```

### Error Recovery

- **Network errors:** Automatically caught and displayed
- **Abort errors:** Silently ignored (user-initiated cancellation)
- **Parse errors:** Falls back to displaying raw content as summary
- **API key errors:** Clear message directing user to set environment variable
