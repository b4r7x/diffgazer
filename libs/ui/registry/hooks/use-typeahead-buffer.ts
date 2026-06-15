"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_TYPEAHEAD_RESET_MS = 500;

/**
 * Small typeahead query buffer for composite widgets.
 *
 * Accumulates printable single-character keystrokes, resets after `resetMs`
 * of idle time, and returns the current buffer lowercased via
 * `String.prototype.toLocaleLowerCase()` (host environment's default locale).
 * Using the locale-aware variant keeps the returned query consistent with
 * label comparisons in `matchesSearch`/`typeaheadSearch` for locale-sensitive
 * characters such as Turkish dotted/dotless I.
 */
export function useTypeaheadBuffer(resetMs = DEFAULT_TYPEAHEAD_RESET_MS) {
  const bufferRef = useRef("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (key: string): string | null => {
      if (key.length !== 1) return null;
      // Space extends a non-empty query (multi-word labels like "New York") but
      // is rejected on an empty buffer so it stays available as the select/activate
      // key (APG/Radix typeahead behavior).
      if (key === " " && bufferRef.current === "") return null;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);

      bufferRef.current += key;
      timerRef.current = window.setTimeout(() => {
        bufferRef.current = "";
        timerRef.current = null;
      }, resetMs);

      return bufferRef.current.toLocaleLowerCase();
    },
    [resetMs],
  );
}
