/** Exact handler return value that declines a matched key. */
export const DECLINE = false as const;

/** Type of the exact decline sentinel returned from a keyboard handler. */
export type Decline = typeof DECLINE;

/**
 * Keyboard handler signature. Return `DECLINE` to decline the event so the next
 * registered handler for the same hotkey runs; any other return value (including
 * `undefined`) marks the event handled and stops dispatch.
 */
export type KeyHandler = (event: KeyboardEvent) => unknown;

interface NormalizedKeyInput<O> {
  handlerMap: Record<string, KeyHandler>;
  options: O | undefined;
}

/**
 * Normalizes `useKey` overload inputs into a handler map plus optional options
 * object.
 */
export function normalizeKeyInput<O>(
  first: string | readonly string[] | Record<string, KeyHandler>,
  second?: KeyHandler | O,
  third?: O,
): NormalizedKeyInput<O> {
  if (typeof first === "string") {
    if (typeof second !== "function") {
      throw new Error("Expected a handler function as the second argument for a string key");
    }
    return { handlerMap: { [first]: second as KeyHandler }, options: third };
  }
  if (Array.isArray(first)) {
    if (typeof second !== "function") {
      throw new Error("Expected a handler function as the second argument for an array of keys");
    }
    return {
      handlerMap: Object.fromEntries(first.map((k) => [k, second as KeyHandler])),
      options: third,
    };
  }
  // first is Record<string, KeyHandler>, second (if present) is options
  // Cast needed: Array.isArray() doesn't narrow readonly arrays in TypeScript
  return {
    handlerMap: first as Record<string, KeyHandler>,
    options: second as O | undefined,
  };
}
