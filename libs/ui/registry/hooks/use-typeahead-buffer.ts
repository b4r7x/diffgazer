"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_TYPEAHEAD_RESET_MS = 500;

export function useTypeaheadBuffer(resetMs = DEFAULT_TYPEAHEAD_RESET_MS) {
  const bufferRef = useRef("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback((key: string): string | null => {
    if (key.length !== 1 || key === " ") return null;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);

    bufferRef.current += key;
    timerRef.current = window.setTimeout(() => {
      bufferRef.current = "";
      timerRef.current = null;
    }, resetMs);

    return bufferRef.current.toLowerCase();
  }, [resetMs]);
}
