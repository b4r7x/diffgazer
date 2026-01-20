/**
 * WHY: Result<T, E> is the ecosystem-standard pattern for type-safe error handling.
 *
 * Benefits over exceptions:
 * - Type safety: Callers MUST handle error cases (no silent throws)
 * - Performance: ~300x faster than exceptions in hot paths
 * - Composability: Can map, chain, and combine Results
 * - Self-documenting: Function signatures show failure modes
 *
 * This pattern is used by: neverthrow (500k/week), fp-ts (1M/week), Effect-TS,
 * and is built into Rust, Kotlin, and Swift.
 *
 * See: docs/decisions/0001-result-type.md
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
