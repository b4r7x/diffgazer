/**
 * Dev-mode guard for the convenience-assertion generics on compound-collection
 * components. The public `TId`/`TValue` parameters narrow the consumer-facing
 * callbacks, but the values they carry originate from untyped children props or
 * DOM dataset strings and are asserted (cast), not validated. This warns in
 * development when a typed callback is about to fire with a value that was never
 * registered, so the gap surfaces instead of flowing out with false type
 * confidence. No-op in production.
 */
export function warnUnregisteredValue(
  component: string,
  value: string,
  registeredValues: Iterable<string>,
): void {
  if (process.env.NODE_ENV === "production") return;
  for (const registered of registeredValues) {
    if (registered === value) return;
  }
  console.warn(
    `${component}: value "${value}" is not registered. The typed callback receives an asserted value that was never collected from a rendered item.`,
  );
}
