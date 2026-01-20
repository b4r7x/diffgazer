# ADR 0001: Result<T, E> Type for Error Handling

## Status

**Accepted**

## Date

2025-01-20

## Context

We need a consistent error handling strategy across the Stargazer codebase. The options considered were:

1. **Thrown exceptions** - JavaScript's native error handling
2. **Callback-based errors** - Node.js style `(err, result)` callbacks
3. **Result<T, E> type** - Rust-inspired discriminated union

### Problems with Exceptions

1. **No type safety**: TypeScript cannot track which functions throw or what they throw
2. **Hidden control flow**: Exceptions create invisible return paths
3. **Performance**: Throwing is ~300x slower than returning a value
4. **Composition**: Cannot easily map/chain operations that might fail

### Ecosystem Alignment

The Result pattern is widely adopted in TypeScript:

| Library | Downloads/week | Pattern |
|---------|----------------|---------|
| neverthrow | 500,000+ | `Result<T, E>` |
| fp-ts | 1,000,000+ | `Either<E, A>` |
| Effect-TS | 200,000+ | `Effect<A, E, R>` |
| true-myth | 50,000+ | `Result<T, E>` |

Languages with built-in Result types:
- Rust: `Result<T, E>`
- Kotlin: `Result<T>`
- Swift: `Result<Success, Failure>`

## Decision

Use a minimal `Result<T, E>` type for all operations that can fail:

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

### Usage Pattern

```typescript
// Returning errors
function parseConfig(raw: string): Result<Config, ConfigError> {
  const parsed = safeParse(raw);
  if (!parsed) {
    return err({ code: "PARSE_ERROR", message: "Invalid JSON" });
  }
  return ok(parsed);
}

// Handling errors
const result = parseConfig(input);
if (!result.ok) {
  console.error(result.error.message);
  return;
}
// result.value is now typed as Config
```

### When to Use Exceptions

Exceptions are still appropriate for:
- **Programmer errors**: Assertion failures, invariant violations
- **Unrecoverable errors**: Out of memory, stack overflow
- **Third-party boundaries**: Libraries that throw

## Consequences

### Positive

1. **Type-safe errors**: Callers must handle error cases
2. **Explicit control flow**: No hidden return paths
3. **Better performance**: No exception overhead in hot paths
4. **Composable**: Can map, chain, and combine Results
5. **Self-documenting**: Function signatures show failure modes

### Negative

1. **Verbose**: More boilerplate than try/catch
2. **Learning curve**: Developers unfamiliar with pattern need onboarding
3. **Interop friction**: Must wrap exception-throwing libraries

### Neutral

1. **Minimal implementation**: We use ~12 lines, not a full library
2. **No dependencies**: Avoids neverthrow/fp-ts dependency
3. **Migration path**: Can adopt more features (map, chain) later

## References

- neverthrow: https://github.com/supermacro/neverthrow
- fp-ts Either: https://gcanti.github.io/fp-ts/modules/Either.ts.html
- Effect-TS: https://effect.website/
- Rust Result: https://doc.rust-lang.org/std/result/
- "Parse, don't validate": https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
