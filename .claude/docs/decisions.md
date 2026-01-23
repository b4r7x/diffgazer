# Architecture Decision Records (ADRs)

These decisions are ACCEPTED. Follow them when writing code.

---

## ADR-0001: Result<T, E> for Error Handling

**Status:** Accepted

### Rule
Use `Result<T, E>` for all operations that can fail. Do NOT use exceptions for expected failures.

### Implementation
```typescript
import { Result, ok, err } from "@repo/core/result";

// Return errors, don't throw
function parseConfig(raw: string): Result<Config, ConfigError> {
  if (!isValid(raw)) {
    return err({ code: "PARSE_ERROR", message: "Invalid" });
  }
  return ok(parsed);
}

// Handle with discriminated union
const result = parseConfig(input);
if (!result.ok) {
  console.error(result.error.message);
  return;
}
// result.value is typed as Config
```

### When to Use Exceptions
Only for:
- Programmer errors (assertion failures)
- Unrecoverable errors (out of memory)
- Third-party library boundaries

### Why
- Type-safe: Callers MUST handle errors
- Performance: ~300x faster than exceptions
- Ecosystem standard: neverthrow, fp-ts, Rust

---

## ADR-0002: Provider Abstraction

**Status:** Accepted

### Rule
Abstract AI providers behind `AIClient` interface. Always show provider selection UI.

### Implementation
```typescript
interface AIClient {
  generate<T>(prompt: string, schema: ZodSchema<T>): Promise<Result<T, AIError>>;
  generateStream(prompt: string, callbacks: StreamCallbacks): Promise<void>;
}
```

### Do NOT
- Hardcode a single provider
- Auto-detect provider without user selection
- Remove provider selection UI (even with one provider)

### Why
- Future providers planned (Ollama, Azure, Bedrock)
- User control over cost/privacy/capability
- Aligns with Vercel AI SDK, LangChain patterns

---

## ADR-0003: CORS Localhost Only

**Status:** Accepted

### Rule
CORS must only allow `localhost` and `127.0.0.1` origins. Reject all others.

### Implementation
```typescript
cors({
  origin: (origin) => {
    if (!origin) return origin;
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return origin;
    }
    return ""; // Reject
  },
})
```

### Do NOT
- Use `*` for CORS origin
- Allow any non-localhost origin
- Weaken CORS restrictions

### Why
- CVE-2024-28224 (Ollama DNS rebinding attack)
- Defense in depth with Host header validation
- Localhost-only tool by design

---

## ADR-0004: XML Escaping for Prompts

**Status:** Accepted

### Rule
Escape `<`, `>`, `&` in all user content before embedding in prompts.

### Implementation
```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const prompt = TEMPLATE.replace("{diff}", escapeXml(userDiff));
```

### Do NOT
- Embed raw user content in prompts
- Skip escaping for "trusted" content
- Use only markdown fences (LLMs handle inconsistently)

### Why
- CVE-2025-53773 (GitHub Copilot prompt injection)
- OWASP LLM Top 10 #1 vulnerability
- 30+ years of proven XML security

---

## ADR-0005: AI Review JSON Output

**Status:** Accepted

### Rule
Use Gemini's `responseSchema` for structured AI output. Do not rely on JSON parsing with repair.

### Implementation
```typescript
const result = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: zodToJsonSchema(ReviewResultSchema),
    maxOutputTokens: 65536, // Use full limit
  },
});
// result.text is GUARANTEED valid JSON
```

### Settings
- `maxOutputTokens`: 65536 (not 32768)
- `responseMimeType`: "application/json"
- `responseSchema`: Zod schema converted to JSON schema

### Do NOT
- Parse streaming JSON with repair logic
- Use 32768 token limit (truncates large reviews)
- Skip schema validation

### Why
- Constrained decoding = 100% valid JSON
- Streaming JSON repair is ~85% reliable
- Reviews need reliability over streaming UX

---

## Quick Reference

| Decision | Rule | CVE/Reason |
|----------|------|------------|
| Error handling | Use Result<T, E> | Type safety, performance |
| Providers | Abstract + UI selection | Extensibility |
| CORS | Localhost only | CVE-2024-28224 |
| Prompts | XML escape user content | CVE-2025-53773 |
| AI output | responseSchema + 65536 tokens | Reliability |

---

## Files Affected

| ADR | Primary Files |
|-----|---------------|
| 0001 | `packages/core/src/result.ts`, all error-returning functions |
| 0002 | `packages/core/src/ai/`, `apps/cli/src/app/screens/` |
| 0003 | `apps/server/src/app.ts` |
| 0004 | `apps/server/src/services/review.ts` |
| 0005 | `packages/core/src/ai/providers/gemini.ts` |
