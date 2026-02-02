# Utilities Reference

Complete reference for utility functions exported from `@repo/core`.

## Result Type

Type-safe error handling.

### Types

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

### Functions

#### ok

Create a success result.

```typescript
function ok<T>(value: T): Result<T, never>;

// Example
const result = ok(42);
// { ok: true, value: 42 }
```

#### err

Create an error result.

```typescript
function err<E>(error: E): Result<never, E>;

// Example
const result = err("Not found");
// { ok: false, error: "Not found" }
```

## Error Utilities

### createError

Create a typed error object.

```typescript
function createError<T extends string>(code: T, message: string): AppError<T>;

// Example
const error = createError("NOT_FOUND", "User not found");
// { code: "NOT_FOUND", message: "User not found" }
```

### getErrorMessage

Extract message from any error type.

```typescript
function getErrorMessage(error: unknown): string;

// Examples
getErrorMessage(new Error("fail")); // "fail"
getErrorMessage("string error");     // "string error"
getErrorMessage({ message: "obj" }); // "obj"
getErrorMessage(null);               // "Unknown error"
```

### isAbortError

Check if error is from AbortController.

```typescript
function isAbortError(error: unknown): boolean;

// Example
try {
  await fetch(url, { signal });
} catch (error) {
  if (isAbortError(error)) {
    return; // User cancelled, don't show error
  }
  throw error;
}
```

### isNodeError

Check if error is a Node.js system error.

```typescript
function isNodeError(error: unknown): error is NodeJS.ErrnoException;

// Example
if (isNodeError(error) && error.code === "ENOENT") {
  console.log("File not found");
}
```

### toError

Convert unknown to Error instance.

```typescript
function toError(error: unknown): Error;

// Examples
toError(new Error("fail")); // Returns same Error
toError("string");          // new Error("string")
toError({ msg: "obj" });    // new Error("[object Object]")
```

### createErrorClassifier

Create a function to classify errors by patterns.

```typescript
function createErrorClassifier<T extends string>(
  rules: ErrorClassificationRule<T>[],
  defaultCode: T,
  defaultMessageFn: (original: string) => string
): (error: unknown) => { code: T; message: string };

interface ErrorClassificationRule<T> {
  patterns: string[];
  code: T;
  message: string;
}

// Example
const classify = createErrorClassifier([
  { patterns: ["ENOENT", "not found"], code: "NOT_FOUND", message: "File not found" },
  { patterns: ["EACCES", "permission"], code: "FORBIDDEN", message: "Access denied" },
], "UNKNOWN", (msg) => `Unexpected: ${msg}`);

const result = classify(new Error("ENOENT: no such file"));
// { code: "NOT_FOUND", message: "File not found" }
```

## Validation

### validateSchema

Validate data against Zod schema.

```typescript
function validateSchema<T, E>(
  data: unknown,
  schema: z.ZodType<T>,
  errorFactory: (message: string) => E
): Result<T, E>;

// Example
const result = validateSchema(data, UserSchema, (msg) => ({
  code: "VALIDATION_ERROR",
  message: msg,
}));

if (result.ok) {
  // result.value is typed as User
}
```

### parseAndValidate

Parse JSON string and validate against schema.

```typescript
function parseAndValidate<T, E>(
  json: string,
  schema: z.ZodType<T>,
  errorFactory: (message: string) => E
): Result<T, E>;

// Example
const result = parseAndValidate(jsonString, ConfigSchema, (msg) => msg);
```

### isValidUuid

Check if string is valid UUID.

```typescript
function isValidUuid(value: string): boolean;

// Example
isValidUuid("123e4567-e89b-12d3-a456-426614174000"); // true
isValidUuid("not-a-uuid"); // false
```

### assertValidUuid

Assert string is valid UUID (throws if not).

```typescript
function assertValidUuid(value: string): asserts value is string;
```

### isRelativePath

Check if path is relative (not absolute).

```typescript
function isRelativePath(path: string): boolean;
```

### isValidProjectPath

Check if path is a valid project directory.

```typescript
function isValidProjectPath(path: string): boolean;
```

## JSON

### safeParseJson

Safely parse JSON with error handling.

```typescript
function safeParseJson<E>(
  json: string,
  errorFactory: (message: string, details?: string) => E
): Result<unknown, E>;

// Example
const result = safeParseJson(input, (msg, details) => ({
  type: "parse_error",
  message: msg,
  details,
}));

if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error.message);
}
```

## Sanitization

### sanitizeUnicode

Remove control characters and normalize unicode.

```typescript
function sanitizeUnicode(input: string): string;

// Example
const clean = sanitizeUnicode(userInput);
```

### escapeXml

Escape XML special characters for prompt safety.

```typescript
function escapeXml(input: string): string;

// Example
escapeXml("<script>alert('xss')</script>");
// "&lt;script&gt;alert('xss')&lt;/script&gt;"
```

Escapes:
- `<` to `&lt;`
- `>` to `&gt;`
- `&` to `&amp;`

## File Operations

### safeReadFile

Read file with error handling.

```typescript
function safeReadFile(path: string): Promise<Result<string, FileIOError>>;

// Example
const result = await safeReadFile("/path/to/file");
if (result.ok) {
  console.log(result.value);
}
```

### atomicWriteFile

Write file atomically (write to temp, then rename).

```typescript
function atomicWriteFile(
  path: string,
  content: string
): Promise<Result<void, FileIOError>>;

// Example
const result = await atomicWriteFile("/path/to/file", content);
```

### ensureDirectory

Create directory if it doesn't exist.

```typescript
function ensureDirectory(path: string): Promise<Result<void, FileIOError>>;
```

## Streaming

### parseSSEStream

Parse Server-Sent Events stream.

```typescript
function parseSSEStream<T>(
  stream: ReadableStream<Uint8Array>,
  options: SSEParserOptions<T>
): Promise<SSEParseResult>;

interface SSEParserOptions<T> {
  onChunk: (chunk: string) => void | Promise<void>;
  onComplete: (data: T) => void | Promise<void>;
  onError: (error: Error) => void | Promise<void>;
  parseComplete?: (json: unknown) => T;
}

// Example
await parseSSEStream(response.body, {
  onChunk: (chunk) => updateUI(chunk),
  onComplete: (result) => finalize(result),
  onError: (error) => showError(error),
});
```

## String Utilities

### truncate

Truncate string to max length.

```typescript
function truncate(str: string, maxLength: number): string;

// Example
truncate("Hello World", 5); // "Hello..."
```

### truncateToDisplayLength

Truncate considering display width (CJK characters = 2 width).

```typescript
function truncateToDisplayLength(str: string, maxLength: number): string;
```

## Array Utilities

### chunk

Split array into chunks of specified size.

```typescript
function chunk<T>(array: T[], size: number): T[][];

// Example
chunk([1, 2, 3, 4, 5], 2);
// [[1, 2], [3, 4], [5]]
```

## Formatting

### formatRelativeTime

Format timestamp as relative time.

```typescript
function formatRelativeTime(date: Date | string): string;

// Example
formatRelativeTime(new Date(Date.now() - 60000));
// "1 minute ago"
```

### getScoreColor

Get color for review score.

```typescript
function getScoreColor(score: number): string;

// Example
getScoreColor(9);  // "green"
getScoreColor(6);  // "yellow"
getScoreColor(3);  // "red"
```

## State Helpers

### createErrorState

Create error state object.

```typescript
function createErrorState<E>(error: E): { status: "error"; error: E };

// Example
const state = createErrorState({ code: "FAILED", message: "Oops" });
// { status: "error", error: { code: "FAILED", message: "Oops" } }
```

## Review Module

Exports from `@repo/core/review`:

### triageReview

Run triage review with lenses.

```typescript
function triageReview(
  client: AIClient,
  diff: ParsedDiff,
  options?: TriageOptions
): Promise<Result<TriageResult, TriageError>>;

interface TriageOptions {
  profile?: ReviewProfile;
  lenses?: LensId[];
  filter?: SeverityFilter;
}

// Example
const result = await triageReview(client, diff, {
  lenses: ["correctness", "security"],
});
```

### triageWithProfile

Run triage with a named profile.

```typescript
function triageWithProfile(
  client: AIClient,
  diff: ParsedDiff,
  profileId: string
): Promise<Result<TriageResult, TriageError>>;
```

### drilldownIssue

Deep analysis of a specific issue.

```typescript
function drilldownIssue(
  client: AIClient,
  issue: TriageIssue,
  diff: ParsedDiff,
  allIssues?: TriageIssue[],
  options?: DrilldownOptions
): Promise<Result<DrilldownResult, DrilldownError>>;

interface DrilldownOptions {
  traceRecorder?: TraceRecorder;
  onEvent?: (event: AgentStreamEvent) => void;
}
```

### drilldownIssueById

Find and drilldown issue by ID.

```typescript
function drilldownIssueById(
  client: AIClient,
  issueId: string,
  triageResult: TriageResult,
  diff: ParsedDiff,
  options?: DrilldownOptions
): Promise<Result<DrilldownResult, DrilldownError>>;
```

### drilldownMultiple

Run drilldown on multiple issues sequentially.

```typescript
function drilldownMultiple(
  client: AIClient,
  issues: TriageIssue[],
  diff: ParsedDiff,
  allIssues?: TriageIssue[],
  options?: DrilldownOptions
): Promise<Result<DrilldownResult[], DrilldownError>>;
```

### getLens / getLenses

Get lens definitions.

```typescript
function getLens(id: LensId): Lens;
function getLenses(ids: LensId[]): Lens[];

// Example
const lens = getLens("security");
const lenses = getLenses(["correctness", "security"]);
```

### getProfile

Get profile definition.

```typescript
function getProfile(id: ProfileId): ReviewProfile;

// Example
const profile = getProfile("strict");
```

### generateFingerprint

Generate a unique fingerprint for an issue for deduplication.

```typescript
function generateFingerprint(issue: TriageIssue, diffHunk?: string): string;

// Example
const fingerprint = generateFingerprint(issue);
// "a1b2c3d4e5f6..." (SHA-256 hash)
```

### mergeIssues

Deduplicate issues by fingerprint, keeping highest severity.

```typescript
function mergeIssues(issues: TriageIssue[]): TriageIssue[];

// Example
const deduplicated = mergeIssues(allIssues);
```

### normalizeTitle

Normalize issue title for comparison (lowercase, remove stop words).

```typescript
function normalizeTitle(title: string): string;

// Example
normalizeTitle("The missing validation in handler");
// "missing validation handler"
```

### getHunkDigest

Generate SHA-1 hash of normalized diff hunk.

```typescript
function getHunkDigest(diffHunk: string): string;

// Example
const digest = getHunkDigest(hunk);
// "abc123..." (SHA-1 hash)
```

### shouldSuggestDrilldown

Check if an issue should be suggested for deeper analysis.

```typescript
function shouldSuggestDrilldown(issue: TriageIssue): boolean;

// Returns true if:
// - Severity is blocker or high
// - Confidence < 0.8
// - Category is security
// - Rationale contains uncertainty words
```

### getSuggestionReason

Get human-readable reason for drilldown suggestion.

```typescript
function getSuggestionReason(issue: TriageIssue): string;

// Example
getSuggestionReason(blockerIssue);
// "This BLOCKER severity issue could benefit from deeper analysis."
```

### TraceRecorder

Record AI interaction traces for debugging.

```typescript
class TraceRecorder {
  wrap<T>(
    operation: string,
    description: string,
    fn: () => Promise<T>
  ): Promise<T>;

  getTrace(): TraceEntry[];
}

// Example
const recorder = new TraceRecorder();
const result = await recorder.wrap(
  "generateAnalysis",
  "analyzing issue",
  () => client.generate(prompt, schema)
);
const trace = recorder.getTrace();
```

### Constants

```typescript
import { LENSES, LENS_LIST, PROFILES, PROFILE_LIST } from "@repo/core/review";

LENSES;       // Record<LensId, Lens>
LENS_LIST;    // Lens[]
PROFILES;     // Record<ProfileId, ReviewProfile>
PROFILE_LIST; // ReviewProfile[]
```

## Storage Module

Exports from `@repo/core/storage`:

### saveTriageReview

Save a triage review.

```typescript
function saveTriageReview(
  options: SaveTriageReviewOptions
): Promise<Result<TriageReviewMetadata, StoreError>>;

interface SaveTriageReviewOptions {
  projectPath: string;
  staged: boolean;
  result: TriageResult;
  diff: ParsedDiff;
  branch: string | null;
  commit: string | null;
  profile?: ProfileId;
  lenses: LensId[];
  drilldowns?: DrilldownResult[];
}
```

### listTriageReviews

List saved triage reviews.

```typescript
function listTriageReviews(
  projectPath?: string
): Promise<Result<{ items: TriageReviewMetadata[]; warnings: string[] }, StoreError>>;
```

### getTriageReview

Get a specific triage review.

```typescript
function getTriageReview(
  reviewId: string
): Promise<Result<SavedTriageReview, StoreError>>;
```

### deleteTriageReview

Delete a triage review.

```typescript
function deleteTriageReview(
  reviewId: string
): Promise<Result<{ existed: boolean }, StoreError>>;
```

### addDrilldownToReview

Add drilldown result to existing review.

```typescript
function addDrilldownToReview(
  reviewId: string,
  drilldown: DrilldownResult
): Promise<Result<void, StoreError>>;
```

## AI Module

Exports from `@repo/core/ai`:

### createAIClient

Create an AI client for a provider.

```typescript
function createAIClient(config: AIClientConfig): Result<AIClient, AIError>;

interface AIClientConfig {
  provider: "gemini" | "openai" | "anthropic";
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Example
const result = createAIClient({
  provider: "gemini",
  apiKey: process.env.GEMINI_API_KEY,
});

if (result.ok) {
  const client = result.value;
  // Use client.generate() or client.generateStream()
}
```

## Cross-References

- [Packages: Core](../packages/core.md) - Package overview
- [Packages: Schemas](../packages/schemas.md) - Zod schemas
- [Architecture: Data Flow](../architecture/data-flow.md) - How utilities are used
