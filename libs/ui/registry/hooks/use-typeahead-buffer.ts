"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_TYPEAHEAD_RESET_MS = 500;

/**
 * Small typeahead query buffer for composite widgets.
 *
 * Accumulates printable single-character keystrokes, resets after `resetMs`
 * of idle time, and returns the current buffer lowercased via
 * `String.prototype.toLocaleLowerCase()` (host environment's default locale),
 * matching the locale-aware fold `typeaheadSearch` applies to labels so
 * locale-sensitive characters such as Turkish dotted/dotless I compare the same
 * way on both sides. Changing `resetKey` starts a new interaction session
 * instead of carrying a partial query across a close/reopen boundary.
 */
export function useTypeaheadBuffer(resetMs = DEFAULT_TYPEAHEAD_RESET_MS, resetKey?: unknown) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    bufferRef.current = "";
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is a session-boundary trigger; only its identity matters.
  useEffect(() => {
    reset();
    return reset;
  }, [reset, resetKey]);

  return useCallback(
    (key: string, { extendOnly = false }: { extendOnly?: boolean } = {}): string | null => {
      // One code point, not one code unit: `key.length` alone drops every
      // astral character (emoji, rarer CJK) while still rejecting ArrowDown/F8.
      if ([...key].length !== 1) return null;
      // Space extends a non-empty query (multi-word labels like "New York") but
      // is rejected on an empty buffer so it stays available as the select/activate
      // key (APG/Radix typeahead behavior). Callers opt other keys into the same
      // extend-only contract via `extendOnly` (e.g. j/k, which navigate instead of
      // starting a query).
      if ((key === " " || extendOnly) && bufferRef.current === "") return null;
      if (timerRef.current !== null) clearTimeout(timerRef.current);

      bufferRef.current += key;
      timerRef.current = setTimeout(() => {
        bufferRef.current = "";
        timerRef.current = null;
      }, resetMs);

      return bufferRef.current.toLocaleLowerCase();
    },
    [resetMs],
  );
}
