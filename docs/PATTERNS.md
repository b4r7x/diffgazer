# Patterns to Preserve

This document explains **WHY** certain patterns exist in the codebase. These patterns may appear over-engineered at first glance but serve important purposes.

> **Do not simplify these patterns without understanding their rationale.**

---

## 1. Result<T, E> Type

**Location**: `packages/core/src/result.ts`

**Pattern**:
```typescript
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

### WHY: Ecosystem Standard

The Result type is the dominant error-handling pattern in the TypeScript/JavaScript ecosystem:

| Library | Pattern | Weekly Downloads |
|---------|---------|------------------|
| neverthrow | Result<T, E> | 500k+ |
| fp-ts | Either<E, A> | 1M+ |
| Effect-TS | Effect<A, E, R> | 200k+ |
| Rust | Result<T, E> | N/A (language built-in) |

### WHY: Performance

Exceptions are approximately **300x slower** than Result returns in hot paths:

```typescript
// Exception path: ~3000ns
try { throw new Error(); } catch (e) { }

// Result path: ~10ns
if (!result.ok) { return result; }
```

### WHY: Type Safety

Exceptions lose type information. Result preserves it:

```typescript
// Exceptions: No type safety
function parseJson(s: string): unknown {
  return JSON.parse(s); // Can throw, but what type?
}

// Result: Full type safety
function parseJson(s: string): Result<JsonValue, ParseError> {
  // Caller MUST handle error case
}
```

### References

- ADR: [0001-result-type.md](./decisions/0001-result-type.md)
- neverthrow: https://github.com/supermacro/neverthrow
- Effect-TS: https://effect.website/

---

## 2. Provider Selection UI

**Location**: `apps/cli/src/app/screens/` (onboarding flow)

**Pattern**: Interactive provider selection even when only one provider is configured.

### WHY: Future Extensibility

The AI provider landscape is evolving rapidly. Our abstraction aligns with:

| SDK/Framework | Provider Model |
|---------------|----------------|
| Vercel AI SDK | Multi-provider with unified interface |
| LangChain | Provider-agnostic chains |
| LiteLLM | 100+ provider proxy |

### WHY: Planned Providers

Current: Anthropic, OpenAI, Google Gemini

Planned:
- Local models (Ollama, llama.cpp)
- Azure OpenAI
- AWS Bedrock
- Custom endpoints

### WHY: User Control

Users should explicitly choose their provider for:
- Cost awareness (providers have different pricing)
- Capability matching (some models better at code review)
- Privacy preferences (local vs. cloud)

### References

- ADR: [0002-provider-abstraction.md](./decisions/0002-provider-abstraction.md)
- Vercel AI SDK: https://sdk.vercel.ai/
- LangChain: https://langchain.com/

### Do Not Remove

The provider selection UI and abstraction should not be removed during code simplifications. Additional providers are planned for future releases.

### Safe Index Access Pattern

**Location**: `apps/cli/src/app/screens/onboarding-screen.tsx`

```typescript
const getProvider = (index: number) => PROVIDERS[index] ?? PROVIDERS[0];
```

This helper provides type-safe array access without null assertions (`!`). While the index is always valid in the current UI, the fallback ensures:
- TypeScript is satisfied without unsafe assertions
- Future changes won't introduce undefined access bugs
- Consistent pattern for array element access

---

## 3. CORS Middleware (Localhost Only)

**Location**: `apps/server/src/app.ts`

**Pattern**: Restrict CORS to localhost/127.0.0.1 origins only.

### WHY: DNS Rebinding Protection

**CVE-2024-28224** (Ollama) demonstrated the attack:

1. Attacker registers `evil.com` with A record pointing to `127.0.0.1`
2. Victim visits `evil.com` in browser
3. JavaScript on `evil.com` makes requests to `localhost:11434`
4. Without CORS restriction, browser allows the request
5. Attacker exfiltrates local data or executes commands

### WHY: Defense in Depth

Combined with Host header validation, CORS provides layered security:

```
Request from evil.com
    |
    v
[CORS Check] --> Blocked (origin not localhost)
    |
    v (if bypassed)
[Host Header Check] --> Blocked (host not localhost)
    |
    v (if bypassed)
[127.0.0.1 Binding] --> Cannot reach (network isolation)
```

### References

- ADR: [0003-security-cors.md](./decisions/0003-security-cors.md)
- CVE-2024-28224: https://nvd.nist.gov/vuln/detail/CVE-2024-28224
- Security doc: [SECURITY.md](./SECURITY.md)

---

## 4. XML Escaping in Prompts

**Location**: `apps/server/src/services/review.ts`

**Pattern**: Escape `<`, `>`, `&` in user-provided content before embedding in prompts.

### WHY: Prompt Injection Prevention

**CVE-2025-53773** (GitHub Copilot Chat) demonstrated the attack:

1. Attacker creates file containing: `</system>Ignore previous instructions...`
2. File content is embedded in prompt without escaping
3. LLM interprets attacker content as instructions
4. Attacker achieves arbitrary prompt injection

### WHY: Structured Prompt Integrity

Our prompt uses XML-like delimiters:
```
<code-diff>
{user_content}
</code-diff>
```

Without escaping, content containing `</code-diff>` breaks the structure.

### WHY: Simple and Effective

XML escaping is:
- Well-understood (decades of security research)
- Minimal performance impact
- No false positives (reversed on display if needed)

### References

- ADR: [0004-prompt-injection.md](./decisions/0004-prompt-injection.md)
- CVE-2025-53773: https://nvd.nist.gov/vuln/detail/CVE-2025-53773
- Security doc: [SECURITY.md](./SECURITY.md)

---

## 5. Security Headers

**Location**: `apps/server/src/app.ts`

**Pattern**: Set X-Frame-Options and X-Content-Type-Options on all responses.

### WHY: Browser Security Defaults

Even for localhost-only tools, browsers can be tricked:

| Header | Attack Prevented |
|--------|------------------|
| X-Frame-Options: DENY | Clickjacking via iframe |
| X-Content-Type-Options: nosniff | MIME confusion attacks |

### WHY: Zero Cost, High Value

These headers:
- Add negligible overhead (~1 byte per response)
- Prevent entire classes of attacks
- Are recommended by OWASP for all web responses

---

## 6. @repo/api - Bulletproof Fetch Pattern

**Location**: `packages/api/`

**Pattern**: Shared API client using native fetch with interceptors.

### WHY: Consistent API Layer

The Bulletproof React pattern recommends a centralized API layer:

```typescript
// packages/api/src/client.ts
import { createApiClient } from "@repo/api";

const api = createApiClient({ baseUrl: "http://127.0.0.1:3000" });

// Type-safe API calls
const config = await api.get<{ configured: boolean }>("/config/check");
await api.post("/config", { provider, apiKey });
await api.delete("/config");
```

### WHY: CSRF Protection

The client automatically sets `Content-Type: application/json` which bypasses CSRF middleware that only checks form-like content types:

```typescript
// Request interceptor (automatic)
headers: {
  "Content-Type": "application/json",
  "Accept": "application/json",
}
```

### WHY: Centralized Error Handling

The response interceptor:
1. Unwraps the server's `{ success: true, data: T }` format
2. Extracts error messages from `{ success: false, error: { message } }`
3. Throws typed `ApiError` with status code

```typescript
// In hooks, errors are caught and typed
try {
  const result = await api.get<Config>("/config");
} catch (e) {
  const err = e as ApiError;
  console.log(err.message, err.status, err.code);
}
```

### Usage in Apps

**CLI** (`apps/cli/src/lib/api.ts`):
```typescript
import { createApiClient } from "@repo/api";

export function createApi(baseUrl: string) {
  return createApiClient({ baseUrl });
}
```

**Hooks** (`apps/cli/src/hooks/use-config.ts`):
```typescript
import { createApi, type ApiError } from "../lib/api.js";

const api = useMemo(() => createApi(baseUrl), [baseUrl]);

const checkConfig = useCallback(async () => {
  try {
    const result = await api.get<{ configured: boolean }>("/config/check");
    setCheckState(result.configured ? "configured" : "unconfigured");
  } catch (e) {
    const err = e as ApiError;
    setError({ message: err.message });
  }
}, [api]);
```

### References

- Bulletproof React API Layer: https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md
- Fetch Interceptors Pattern: https://dev.to/joshuaamaju/fetch-interceptors-1bb9

---

## 7. React 19: No Manual Memoization

**Location**: All React hooks (`apps/cli/src/hooks/`)

**Pattern**: Plain async functions instead of `useCallback` wrappers.

### WHY: React 19 Compiler Auto-Memoizes

React 19's Compiler automatically:
- Stabilizes function references
- Memoizes values and functions
- Determines when components should skip re-rendering

### WHEN useCallback/useMemo IS Needed

Only in these cases:
1. Function passed to `memo()`-wrapped component
2. Function used as dependency of another Hook
3. Expensive calculations (rare)

### WHEN useCallback/useMemo IS NOT Needed

- Functions called imperatively (`config.checkConfig()`)
- Functions not passed as props to memoized components
- Simple state updates

### References

- React 19 Compiler: https://react.dev/learn/react-compiler
- useCallback docs: https://react.dev/reference/react/useCallback
- GitHub Issue: https://github.com/facebook/react/issues/31913

---

## Summary: Do Not Remove

| Pattern | Removal Impact |
|---------|----------------|
| Result<T, E> | Lose type safety, 300x slower in hot paths |
| Provider UI | Block future provider additions |
| Safe index access | Require unsafe `!` assertions |
| CORS restriction | Enable DNS rebinding attacks |
| XML escaping | Enable prompt injection attacks |
| Security headers | Enable clickjacking/MIME attacks |
| @repo/api | Lose centralized error handling, CSRF protection |
| No manual memoization | N/A - adding useCallback/useMemo adds unnecessary complexity |

These patterns exist because **security and correctness trump simplicity**.
