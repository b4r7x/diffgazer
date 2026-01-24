# Data Flow

This document describes how data flows through Stargazer during key operations.

## Triage Review Flow

### 1. User Initiates Triage

```
CLI                    Server                  Core
 |                       |                       |
 |-- GET /triage/stream->|                       |
 |   ?staged=true        |                       |
 |   &lenses=correctness |                       |
 |   &profile=strict     |                       |
 |                       |-- getDiff() --------->|
 |                       |<-- raw diff --------- |
 |                       |                       |
 |                       |-- parseDiff() ------->|
 |                       |<-- ParsedDiff ------- |
 |                       |                       |
 |                       |-- triageReview() ---->|
 |                       |   (per lens)          |
 |<-- SSE: lens_start -- |                       |
 |                       |<-- TriageResult ----- |
 |<-- SSE: lens_complete |                       |
 |                       |                       |
 |                       |-- saveTriageReview()->|
 |                       |<-- reviewId --------- |
 |<-- SSE: complete ---- |                       |
```

### 2. SSE Event Types

```typescript
type TriageStreamEvent =
  | { type: "chunk"; content: string }
  | { type: "lens_start"; lens: string; index: number; total: number }
  | { type: "lens_complete"; lens: string }
  | { type: "complete"; result: TriageResult; reviewId: string }
  | { type: "error"; error: TriageError };
```

### 3. Triage Processing

```
         Input Diff
              |
              v
    +-------------------+
    |   Parse Diff      |
    |   (file-level)    |
    +-------------------+
              |
              v
    +-------------------+
    |  Select Lenses    |
    | (from profile or  |
    |  explicit list)   |
    +-------------------+
              |
     +--------+--------+
     |        |        |
     v        v        v
  +------+ +------+ +------+
  |Lens 1| |Lens 2| |Lens 3|
  +------+ +------+ +------+
     |        |        |
     v        v        v
  +------+ +------+ +------+
  |Issues| |Issues| |Issues|
  +------+ +------+ +------+
     |        |        |
     +--------+--------+
              |
              v
    +-------------------+
    |   Deduplicate     |
    | (file+line+title) |
    +-------------------+
              |
              v
    +-------------------+
    |  Filter Severity  |
    | (minSeverity)     |
    +-------------------+
              |
              v
    +-------------------+
    |    Sort Issues    |
    | (severity, file)  |
    +-------------------+
              |
              v
         TriageResult
```

## Drilldown Flow

### 1. Request Deep Analysis

```
CLI                    Server                  Core
 |                       |                       |
 |-- POST /triage/      |                       |
 |   reviews/:id/       |                       |
 |   drilldown          |                       |
 |   {issueId: "..."}   |                       |
 |                       |                       |
 |                       |-- getTriageReview()-->|
 |                       |<-- SavedTriageReview- |
 |                       |                       |
 |                       |-- getDiff() --------->|
 |                       |<-- diff ------------- |
 |                       |                       |
 |                       |-- drilldownIssueById->|
 |                       |<-- DrilldownResult -- |
 |                       |                       |
 |                       |-- addDrilldownToReview
 |                       |                       |
 |<-- {drilldown: ...} -|                       |
```

### 2. DrilldownResult Structure

```typescript
interface DrilldownResult {
  issueId: string;
  issue: TriageIssue;
  detailedAnalysis: string;   // Deep technical analysis
  rootCause: string;          // Why this issue exists
  impact: string;             // Consequences if not fixed
  suggestedFix: string;       // Step-by-step fix guidance
  patch: string | null;       // Unified diff patch
  relatedIssues: string[];    // IDs of related issues
  references: string[];       // External documentation links
}
```

## Error Handling Flow

```
+---------------+     +---------------+     +---------------+
|   Operation   |---->|    Result     |---->|    Handler    |
+---------------+     +---------------+     +---------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
        { ok: true,   { ok: false,     Error
          value: T }    error: E }     (thrown)
             |              |              |
             v              v              v
         Use value    Handle error    Unrecoverable
```

### Error Classification

```typescript
const classifyError = createErrorClassifier<AIErrorCode>(
  [
    { patterns: ["401", "api key"], code: "API_KEY_INVALID", message: "Invalid API key" },
    { patterns: ["429", "rate limit"], code: "RATE_LIMITED", message: "Rate limited" },
    { patterns: ["network", "fetch"], code: "NETWORK_ERROR", message: "Network error" },
  ],
  "MODEL_ERROR",
  (msg) => msg
);
```

## Session Flow

### 1. Session Creation

```
CLI                    Server                  Storage
 |                       |                       |
 |-- POST /sessions --->|                       |
 |   {projectPath}      |                       |
 |                       |-- createSession() -->|
 |                       |<-- sessionId --------|
 |<-- {id, created} ----|                       |
```

### 2. Session Resume

```
CLI                    Server                  Storage
 |                       |                       |
 |-- GET /sessions ---->|                       |
 |                       |-- listSessions() --->|
 |                       |<-- sessions[] ------|
 |<-- sessions[] -------|                       |
 |                       |                       |
 |   [User selects]     |                       |
 |                       |                       |
 |-- GET /sessions/:id->|                       |
 |                       |-- loadSession() ---->|
 |                       |<-- session ----------|
 |<-- session ----------|                       |
```

## Configuration Flow

### 1. Initial Setup

```
+------------------+
|   Onboarding     |
|   Screen         |
+--------+---------+
         | User selects provider
         v
+------------------+
|  API Key Input   |
+--------+---------+
         | POST /config
         v
+------------------+     +--------------+
|  Server          |---->|   Keyring    |
|  saveConfig()    |     |   (or vault) |
+------------------+     +--------------+
```

### 2. Config Check

```
CLI                    Server                  Secrets
 |                       |                       |
 |-- GET /config/check->|                       |
 |                       |-- hasApiKey() ------>|
 |                       |<-- boolean ----------|
 |<-- {configured: bool}|                       |
```

## AI Request Flow

### 1. Structured Generation

```
+------------------+
| createAIClient() |
|  (provider)      |
+--------+---------+
         |
         v
+------------------+
|    generate()    |
|  (prompt, schema)|
+--------+---------+
         | HTTPS
         v
+------------------+
|   AI Provider    |
|   (Gemini/       |
|    OpenAI/       |
|    Anthropic)    |
+--------+---------+
         | Response
         v
+------------------+
|  generateObject  |
|  (Zod validation)|
+--------+---------+
         |
         v
  Result<T, AIError>
```

### 2. Provider Selection

```
User Selection           Provider Factory         AI Client
      |                        |                       |
      |-- "gemini" ----------->|                       |
      |                        |-- createLanguageModel()
      |                        |<-- LanguageModel -----|
      |<-- Result<AIClient> ---|                       |
```

## Storage Flow

### 1. XDG-Compliant Paths

```
Operation              Path
----------------------------------------------
Config read/write      ~/.config/stargazer/
Session data           ~/.local/share/stargazer/sessions/
Triage reviews         ~/.local/share/stargazer/triage-reviews/
Cache                  ~/.cache/stargazer/
```

### 2. Persistence Operations

```
+------------------+
|   Application    |
+--------+---------+
         |
         v
+------------------+
|   Collection     |
|   API            |
+--------+---------+
         |
         v
+------------------+
|   File System    |
|  (atomic writes) |
+------------------+
```

### 3. Collection Pattern

```typescript
const store = createCollection<SavedTriageReview, Metadata>({
  name: "triage-review",
  dir: paths.triageReviews,
  filePath: paths.triageReviewFile,
  schema: SavedTriageReviewSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
});

// Usage
await store.write(review);
await store.read(reviewId);
await store.list();
await store.remove(reviewId);
```

## Cross-References

- [Architecture Overview](./overview.md) - System design
- [Features: Review Flow](../features/review-flow.md) - Review implementation
- [Features: AI Integration](../features/ai-integration.md) - AI provider details
