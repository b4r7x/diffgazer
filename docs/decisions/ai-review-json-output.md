# AI Review JSON Output: Problem Analysis and Solutions

> **Status**: Decision Required
> **Date**: 2026-01-22
> **Context**: AI review returns malformed JSON, showing "No issues found!" when parsing fails

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [How Other Tools Solve This](#3-how-other-tools-solve-this)
4. [Available Solutions](#4-available-solutions)
5. [Detailed Comparison](#5-detailed-comparison)
6. [Recommendation](#6-recommendation)
7. [Implementation Plan](#7-implementation-plan)

---

## 1. Problem Statement

### What's Happening

When running `stargazer` AI review, the output shows:

```
[Warning] AI response was not valid JSON, using raw content

Summary: ```json
{
  "summary": "The diff introduces extensive structural...",
  "issues": [
    {
      "severity": "warning",
      "category": "logic",
...
No issues found!
```

### Why This Is Bad

1. **Misleading UI**: "No issues found!" appears even when issues were detected
2. **Lost data**: The actual issues from the AI are discarded
3. **Inconsistent**: Sometimes works, sometimes doesn't

### When It Happens

- Large diffs (many files, many lines)
- Complex code changes
- Obfuscated or unusual code patterns

---

## 2. Root Cause Analysis

### Root Cause #1: Markdown Wrapping

Gemini often returns JSON wrapped in markdown code blocks:

```markdown
Here's my analysis:

```json
{
  "summary": "...",
  "issues": [...]
}
```

Let me know if you need more details.
```

The current code does `JSON.parse(content)` which fails because of the markdown.

**Location**: `apps/server/src/api/routes/review.ts:54`

### Root Cause #2: Token Limit Truncation

The current default is 32,768 output tokens, but:
- Gemini 2.5-flash supports up to **65,536 output tokens**
- Large diffs with many issues can exceed 32K tokens
- When truncated, JSON is cut mid-structure:

```json
{
  "summary": "...",
  "issues": [
    {
      "severity": "warning",
      "description": "The code has a bug in
```

**Location**: `packages/core/src/ai/providers/gemini.ts:12`

### Root Cause #3: No JSON Mode Enabled

The streaming endpoint does NOT use Gemini's JSON mode:

```typescript
// Current code - NO JSON enforcement
const stream = await client.models.generateContentStream({
  model,
  contents: prompt,
  config: getGenerationConfig(config),  // json=false by default
});
```

The non-streaming `generate()` method DOES use JSON mode, but reviews use streaming.

**Location**: `packages/core/src/ai/providers/gemini.ts:73-79`

### Root Cause #4: Bad Fallback Logic

When JSON parsing fails, the fallback creates an empty issues array:

```typescript
let result: ReviewResult = { summary: content, issues: [] };
// ...
} catch {
  parseWarning = "AI response was not valid JSON, using raw content";
}
```

Then the UI shows:
```typescript
{data.issues.length > 0 ? (
  // show issues
) : (
  <Text color="green">No issues found!</Text>  // MISLEADING!
)}
```

**Locations**:
- `apps/server/src/api/routes/review.ts:49-63`
- `apps/cli/src/features/review/components/review-display.tsx:99-103`

---

## 3. How Other Tools Solve This

### CodeRabbit (Most Similar to Stargazer)

**Approach**: Buffer full response, no streaming for code reviews

> "We initially considered streaming responses ideal for IDE reviews. However, large prompts with extensive context engineering caused garbled output from the model and missing tool calls. Instead, we chose to wait a bit longer to get complete outputs."
> — [CodeRabbit Blog](https://www.coderabbit.ai/blog/how-we-built-our-ai-code-review-tool-for-ides)

- Uses multi-model orchestration
- Reviews take 10-20 minutes for large PRs
- Processes batch of files simultaneously
- No real-time streaming to users

### OpenCode CLI (sst/opencode)

**Approach**: Vercel AI SDK + Zod schemas + Tool calling

- Uses `@ai-sdk/google` for Gemini integration
- Defines tools with Zod schemas for parameters
- Has `experimental_repairToolCall` for malformed responses
- Falls back to returning "invalid" tool with error details

### Claude Code (Anthropic)

**Approach**: Tool use forcing + Constrained decoding

- Uses `tool_choice: { type: "tool", name: "output_review" }` to force structured output
- Prefills assistant response with `{` to ensure JSON start
- New "Structured Outputs" beta (Nov 2025) guarantees schema compliance

### Aider (AI Coding Assistant)

**Approach**: Avoids JSON entirely

> "LLMs produce lower quality code when asked to wrap it in JSON. Models struggle with escape sequences and quote conflicts."
> — [Aider Blog](https://aider.chat/2024/08/14/code-in-json.html)

- Uses SEARCH/REPLACE plain text blocks for code edits
- Layered fuzzy matching handles imperfect output
- Implements response continuation for truncated outputs

---

## 4. Available Solutions

### Solution A: Use Gemini's `responseSchema` (Constrained Decoding)

**How it works**: Gemini's API supports guaranteed JSON output via constrained decoding.

```typescript
const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",  // Force JSON output
    responseSchema: zodToJsonSchema(ReviewResultSchema),  // Define structure
    maxOutputTokens: 65536,
  },
});
// response.text is GUARANTEED to be valid JSON matching schema
```

**Why it works**:
- Constrained decoding sets probability of invalid tokens to 0
- Mathematically impossible to produce invalid JSON
- OpenAI achieves 100% reliability with this approach

**Trade-offs**:
- ❌ No streaming (must wait for full response)
- ❌ May slightly degrade reasoning quality for complex tasks
- ✅ 100% reliable JSON
- ✅ No parsing/repair code needed

### Solution B: Use Instructor Library

**How it works**: Battle-tested TypeScript library for structured LLM output.

```typescript
import Instructor from "@instructor-ai/instructor";

const client = Instructor({
  client: geminiClient,
  mode: "JSON",
});

const review = await client.chat.completions.create({
  response_model: ReviewResultSchema,  // Zod schema
  messages: [{ role: "user", content: prompt }],
  max_retries: 3,  // Auto-retry on validation failure
});
```

**Why it works**:
- Wraps LLM calls with validation
- Automatic retries when schema validation fails
- Supports 15+ providers (OpenAI, Anthropic, Gemini, etc.)

**Trade-offs**:
- ❌ Adds external dependency
- ❌ Still no streaming
- ✅ ~99% reliability with retries
- ✅ Multi-provider support for future

### Solution C: Two-Phase Approach

**How it works**: Stream text for UX, then extract structure.

```typescript
// Phase 1: Stream for good UX
const textReview = await streamReview(diff);  // Shows typewriter effect

// Phase 2: Structure extraction
const structuredReview = await client.generateContent({
  contents: `Extract structured data from this review:\n${textReview}`,
  config: {
    responseMimeType: "application/json",
    responseSchema: zodToJsonSchema(ReviewResultSchema),
  },
});
```

**Why it works**:
- Phase 1: User sees streaming progress (good UX)
- Phase 2: Guaranteed valid JSON (reliable)

**Trade-offs**:
- ❌ 2x API calls (cost)
- ❌ More complex implementation
- ✅ Best UX (streaming feedback)
- ✅ 100% reliable JSON in the end

### Solution D: JSON Repair/Extraction

**How it works**: Parse and fix malformed JSON after streaming.

```typescript
function safeParseJson(text: string): Result<any, Error> {
  // 1. Extract JSON from markdown blocks
  const extracted = extractJson(text);

  // 2. Try direct parse
  try { return ok(JSON.parse(extracted)); } catch {}

  // 3. Repair truncated JSON
  const repaired = repairTruncatedJson(extracted);
  return ok(JSON.parse(repaired));
}
```

**Why it works**:
- Handles markdown wrapping with regex extraction
- Closes unclosed brackets for truncated JSON
- Libraries like `jsonrepair` (npm) handle edge cases

**Trade-offs**:
- ❌ Only ~85% reliable (some edge cases fail)
- ❌ Repaired JSON may have incomplete data
- ✅ Keeps streaming UX
- ✅ Minimal code changes

### Solution E: Hybrid (Reviews: Structured, Chat: Streaming)

**How it works**: Use the right tool for each job.

```typescript
// Reviews: Use structured output (reliability matters more)
const review = await aiClient.generateStructured(prompt, ReviewResultSchema);

// Future chat: Use streaming (UX matters more)
await aiClient.generateStream(prompt, callbacks);
```

**Why it works**:
- Reviews need reliable structured data
- Chat needs real-time streaming feedback
- Different use cases, different trade-offs

---

## 5. Detailed Comparison

| Aspect | A: responseSchema | B: Instructor | C: Two-Phase | D: Repair | E: Hybrid |
|--------|-------------------|---------------|--------------|-----------|-----------|
| **Reliability** | 100% | ~99% | 100% | ~85% | 100%/varies |
| **Streaming** | ❌ No | ❌ No | ✅ Yes | ✅ Yes | Per use case |
| **API Calls** | 1 | 1-3 | 2 | 1 | 1 |
| **Dependencies** | zod-to-json-schema | @instructor-ai | None | jsonrepair (optional) | zod-to-json-schema |
| **Code Complexity** | Low | Medium | Medium | Medium | Medium |
| **Future-Proof** | Yes | Yes (multi-provider) | Yes | No | Yes |

### UX Comparison

**Without Streaming (Solutions A, B)**:
- User sees: Loading spinner → Complete result
- Wait time: 5-30 seconds (depends on diff size)
- Feedback: None until complete

**With Streaming (Solutions C, D)**:
- User sees: Typewriter effect as AI generates
- Perceived wait: Feels faster (progress visible)
- Feedback: Continuous

**Hybrid (Solution E)**:
- Reviews: Wait for complete result (acceptable for "run once" operation)
- Chat: Stream responses (critical for conversation UX)

---

## 6. Recommendation

### For Stargazer Reviews: **Solution A (responseSchema) + keep streaming endpoint**

**Why**:

1. **Reviews are a "run once" operation** - Users press `r`, wait, see results. Streaming adds complexity but limited UX value.

2. **Reliability is critical** - A code review that misses issues is worse than no review. 100% valid JSON > 85% with repair.

3. **Simplifies codebase** - No JSON parsing, extraction, or repair code needed for the happy path.

4. **Keeps options open** - Keep streaming endpoint for backwards compatibility and future chat feature.

### Implementation Plan

1. Add `generateStructured()` method to AIClient
2. Create new `/review` endpoint using structured generation
3. Keep `/review/stream` endpoint for backwards compatibility
4. Increase default maxTokens to 65536
5. Update CLI to use new endpoint

### If You Want Streaming UX

If streaming feedback is important for reviews:

- **Quick fix**: Solution D (JSON repair) - Moderate reliability, keeps streaming
- **Better UX + reliability**: Solution C (Two-phase) - 2x cost but best of both worlds
- **Future consideration**: Wait for Gemini 3 which may support streaming + responseSchema

---

## 7. Implementation Plan

### Phase 1: Add Structured Generation

**File**: `packages/core/src/ai/types.ts`
```typescript
// Add to AIClient interface
generateStructured<T extends z.ZodType>(
  prompt: string,
  schema: T
): Promise<Result<z.infer<T>, AIError>>;
```

**File**: `packages/core/src/ai/providers/gemini.ts`
```typescript
// Increase default
const DEFAULT_MAX_OUTPUT_TOKENS = 65536;

// Add method
async generateStructured<T extends z.ZodType>(prompt: string, schema: T) {
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: zodToJsonSchema(schema),
      maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    },
  });
  return ok(schema.parse(JSON.parse(response.text)));
}
```

### Phase 2: Add New Endpoint

**File**: `apps/server/src/api/routes/review.ts`
```typescript
// New endpoint using structured generation
review.get("/", async (c) => {
  // ... setup ...

  const result = await aiClient.generateStructured(prompt, ReviewResultSchema);

  return c.json({ success: true, result: result.value });
});

// Keep existing streaming endpoint
review.get("/stream", async (c) => {
  // ... existing code (unchanged) ...
});
```

### Phase 3: Update CLI

**File**: `apps/cli/src/features/review/hooks/use-review.ts`
```typescript
// Use new endpoint by default
const endpoint = chunked ? "/review/stream/chunked" : "/review";

// Simpler state for non-streaming
type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };
```

---

## Appendix: Token Limits Reference

| Model | Input Limit | Output Limit |
|-------|-------------|--------------|
| gemini-2.5-flash | 1,048,576 | **65,536** |
| gemini-2.5-pro | 1,048,576 | 65,536 |
| gemini-2.5-flash-lite | 1,048,576 | 65,536 |
| gemini-3-flash-preview | 1,000,000 | 64,000 |
| gemini-3-pro-preview | 1,000,000 | 64,000 |

**Current setting**: 32,768 (missing half the available output!)

---

## References

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) - How constrained decoding achieves 100% reliability
- [Gemini API Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) - responseSchema documentation
- [Instructor Library](https://js.useinstructor.com/) - TypeScript library for structured LLM output
- [CodeRabbit Architecture](https://www.coderabbit.ai/blog/how-we-built-our-ai-code-review-tool-for-ides) - Why they chose buffering over streaming
- [Aider: LLMs are bad at returning code in JSON](https://aider.chat/2024/08/14/code-in-json.html) - Alternative perspective
- [jsonrepair (npm)](https://www.npmjs.com/package/jsonrepair) - JSON repair library
