# Patterns to Preserve

These patterns exist for important reasons. Do not simplify without understanding.

---

## Result<T, E> Type

Location: `packages/core/src/result.ts`

```typescript
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

**Why:**
- Ecosystem standard (neverthrow, fp-ts, Effect-TS, Rust)
- Performance: ~300x faster than exceptions in hot paths
- Type safety: Caller MUST handle error case

**Do not:** Replace with try/catch or throw patterns.

---

## Provider Abstraction

Location: `apps/cli/src/app/screens/` (onboarding)

**Why:**
- Future providers planned (Ollama, Azure, Bedrock)
- User control over cost/capability/privacy
- Aligns with Vercel AI SDK, LangChain patterns

**Do not:** Remove provider selection UI or collapse to single provider.

---

## Safe Index Access

Location: `apps/cli/src/app/screens/onboarding-screen.tsx`

```typescript
const getProvider = (index: number) => PROVIDERS[index] ?? PROVIDERS[0];
```

**Why:**
- Type-safe without `!` assertions
- Future-proof against undefined access

**Do not:** Replace with direct array access or `!` assertions.

---

## CORS Localhost Restriction

Location: `apps/server/src/app.ts`

**Why:** CVE-2024-28224 (Ollama DNS Rebinding attack)

**Do not:** Remove or weaken CORS restrictions.

---

## XML Escaping in Prompts

Location: `apps/server/src/services/review.ts`

**Why:** CVE-2025-53773 (GitHub Copilot Prompt Injection)

**Do not:** Remove escaping or allow raw user content in prompts.

---

## Security Headers

Location: `apps/server/src/app.ts`

**Why:**
- X-Frame-Options: Prevents clickjacking
- X-Content-Type-Options: Prevents MIME attacks

**Do not:** Remove security headers.

---

## @repo/api Client

Location: `packages/api/`

**Why:**
- Centralized error handling
- CSRF protection via Content-Type
- Type-safe API calls

**Do not:** Replace with direct fetch calls in apps.

---

## No Manual Memoization (React 19)

Location: All React hooks in `apps/cli/src/hooks/`

**Why:** React 19 Compiler auto-memoizes.

**When useCallback IS needed:**
- Function passed to `memo()`-wrapped component
- Function used as dependency of another Hook

**When NOT needed:**
- Functions called imperatively
- Functions not passed as props to memoized components

**Do not:** Add useCallback/useMemo unless in the "needed" cases.

---

## Summary

| Pattern | Do Not Remove Because |
|---------|----------------------|
| Result<T, E> | Lose type safety, 300x slower |
| Provider UI | Blocks future providers |
| Safe index | Requires unsafe `!` assertions |
| CORS | Enables DNS rebinding attacks |
| XML escaping | Enables prompt injection |
| Security headers | Enables clickjacking/MIME attacks |
| @repo/api | Loses error handling, CSRF protection |
| No manual memo | Adds unnecessary complexity |
