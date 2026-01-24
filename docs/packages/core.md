# @repo/core

Shared business logic, utilities, and the Result type. This is the foundation package used by both CLI and server.

## Installation

```typescript
import { ok, err, type Result } from "@repo/core";
import { createAIClient } from "@repo/core/ai";
import { parseDiff } from "@repo/core/diff";
import { saveSession } from "@repo/core/storage";
```

## Core Exports

### Result Type

Type-safe error handling without exceptions.

```typescript
import { ok, err, type Result } from "@repo/core";

type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Create success result
const success = ok(42);
// { ok: true, value: 42 }

// Create error result
const failure = err("Something went wrong");
// { ok: false, error: "Something went wrong" }

// Usage pattern
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("Division by zero");
  return ok(a / b);
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // 5
} else {
  console.error(result.error);
}
```

### Error Utilities

```typescript
import {
  createError,
  getErrorMessage,
  isNodeError,
  toError,
  isAbortError,
  createErrorClassifier,
} from "@repo/core";

// Get error message from unknown
const message = getErrorMessage(someError);

// Check if error is abort signal
if (isAbortError(error)) {
  return; // User cancelled, don't show error
}

// Classify errors by pattern
const classifier = createErrorClassifier<ErrorCode>([
  { patterns: ["ENOENT"], code: "NOT_FOUND", message: "File not found" },
  { patterns: ["EACCES"], code: "PERMISSION", message: "Access denied" },
], "UNKNOWN", (msg) => `Unexpected: ${msg}`);

const classified = classifier(someError);
// { code: "NOT_FOUND", message: "File not found" }
```

### Validation

```typescript
import { validateSchema, parseAndValidate, isValidUuid } from "@repo/core";

// Validate against Zod schema
const result = validateSchema(data, UserSchema, (msg) => msg);
if (result.ok) {
  // result.value is typed as User
}

// Parse JSON and validate in one step
const parsed = parseAndValidate(jsonString, UserSchema, (msg) => msg);
```

### JSON Parsing

```typescript
import { safeParseJson } from "@repo/core";

const result = safeParseJson(jsonString, (msg) => `Parse error: ${msg}`);
if (result.ok) {
  // result.value is parsed object
}
```

### Sanitization

```typescript
import { sanitizeUnicode, escapeXml } from "@repo/core";

// Remove control characters, normalize unicode
const clean = sanitizeUnicode(userInput);

// Escape for XML/prompt embedding (CVE-2025-53773 mitigation)
const safe = escapeXml(userInput);
// < becomes &lt;
// > becomes &gt;
// & becomes &amp;
```

### File Operations

```typescript
import { safeReadFile, atomicWriteFile, ensureDirectory } from "@repo/core";

// Safe file read with Result
const content = await safeReadFile("/path/to/file");
if (content.ok) {
  console.log(content.value);
}

// Atomic write (write to temp, then rename)
const writeResult = await atomicWriteFile("/path/to/file", data);

// Ensure directory exists
await ensureDirectory("/path/to/dir");
```

### SSE Parsing

```typescript
import { parseSSEStream, type SSEParserOptions } from "@repo/core";

const result = await parseSSEStream(response.body, {
  onChunk: (chunk) => updateUI(chunk),
  onComplete: (data) => finalize(data),
  onError: (error) => showError(error),
});
```

### String Utilities

```typescript
import { truncate, truncateToDisplayLength } from "@repo/core";

// Truncate by character count
truncate("Hello World", 5); // "Hello..."

// Truncate considering display width (CJK characters)
truncateToDisplayLength("Hello World", 5);
```

### Array Utilities

```typescript
import { chunk } from "@repo/core";

// Split array into chunks
chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
```

## Subpath Exports

### @repo/core/ai

AI client abstraction for multiple providers.

```typescript
import { createAIClient, type AIClient, type StreamCallbacks } from "@repo/core/ai";

// Create client
const result = createAIClient({
  provider: "gemini",
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-2.5-flash",
});

if (!result.ok) {
  console.error(result.error);
  return;
}

const client = result.value;

// Streaming generation
await client.generateStream(prompt, {
  onChunk: (chunk) => process.stdout.write(chunk),
  onComplete: (content, metadata) => console.log("Done:", metadata),
  onError: (error) => console.error(error),
});

// Structured generation with Zod schema
const structured = await client.generate(prompt, ReviewResultSchema);
if (structured.ok) {
  // structured.value is typed as ReviewResult
}
```

### @repo/core/diff

Git diff parsing.

```typescript
import { parseDiff, type FileDiff } from "@repo/core/diff";

const diff = await git.getDiff(true);
const parsed = parseDiff(diff);

// parsed.files: FileDiff[]
// parsed.totalStats: { additions, deletions, totalSizeBytes }

for (const file of parsed.files) {
  console.log(file.filePath, file.operation); // "modified", "added", "deleted"
  console.log(file.stats.additions, file.stats.deletions);
}
```

### @repo/core/storage

Persistence layer for sessions, reviews, and config.

```typescript
import {
  createSession,
  loadSession,
  listSessions,
  saveReview,
  loadReviewHistory,
} from "@repo/core/storage";

// Session operations
const session = createSession(projectPath);
const sessions = await listSessions();
const loaded = await loadSession(sessionId);

// Review history (project-local in .stargazer/)
await saveReview(projectPath, staged, reviewResult, { branch, fileCount });
const history = await loadReviewHistory(projectPath);
```

### @repo/core/secrets

Keyring integration for API keys.

```typescript
import { getSecret, setSecret, deleteSecret } from "@repo/core/secrets";

// Get API key from keyring (or encrypted file fallback)
const apiKey = await getSecret("gemini-api-key");

// Store API key
await setSecret("gemini-api-key", "sk-...");
```

## Type Locations

| Type | Location |
|------|----------|
| `Result<T, E>` | `@repo/core/result` |
| `AppError` | `@repo/core/errors` |
| `AIClient` | `@repo/core/ai/types` |
| `AIError` | `@repo/core/ai/errors` |
| `FileDiff` | `@repo/core/diff/types` |

## Cross-References

- [Packages: Schemas](./schemas.md) - Zod schemas used by core
- [Architecture: Data Flow](../architecture/data-flow.md) - How data flows
- [Features: AI Integration](../features/ai-integration.md) - AI client usage
