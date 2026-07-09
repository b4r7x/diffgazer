"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_RESET_MS = 2000;

/** Status for the most recent copy attempt. */
export type CopyStatus = "idle" | "copied" | "failed";

/** Options for the copy-to-clipboard state machine. */
export interface UseCopyToClipboardOptions {
  /** Idle delay before the `copied`/`failed` status resets. Defaults to 2000ms. */
  resetMs?: number;
  /** Custom clipboard writer; defaults to `navigator.clipboard.writeText`. */
  write?: (text: string) => Promise<void> | void;
  /** Called after a successful write. */
  onCopy?: (text: string) => void;
  /** Called when the write fails. */
  onError?: (error: unknown) => void;
}

/** Current copy status plus an async copy command. */
export interface UseCopyToClipboardResult {
  /** Current state of the last copy attempt. */
  status: CopyStatus;
  /** True while status is copied. */
  copied: boolean;
  /** True while status is failed. */
  failed: boolean;
  /** Writes text and resolves true on success or false on failure. */
  copy: (text: string) => Promise<boolean>;
}

function defaultWrite(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * Copy-to-clipboard state machine with a self-resetting status.
 *
 * Writes `text` to the clipboard, flips status to `copied` (or `failed` on a
 * rejected write), and resets to `idle` after `resetMs`. A repeat copy restarts
 * the timer; the pending timer is cleared on unmount.
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {},
): UseCopyToClipboardResult {
  const { resetMs = DEFAULT_RESET_MS, write = defaultWrite, onCopy, onError } = options;
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleReset = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus("idle");
      timerRef.current = null;
    }, resetMs);
  };

  const copy = async (text: string): Promise<boolean> => {
    attemptRef.current += 1;
    const attemptId = attemptRef.current;
    try {
      await write(text);
      // Stale attempt: a newer copy superseded this one — leave its status/callbacks alone.
      if (attemptId !== attemptRef.current) return true;
      setStatus("copied");
      scheduleReset();
      onCopy?.(text);
      return true;
    } catch (error) {
      if (attemptId !== attemptRef.current) return false;
      setStatus("failed");
      scheduleReset();
      onError?.(error);
      return false;
    }
  };

  return {
    status,
    copied: status === "copied",
    failed: status === "failed",
    copy,
  };
}
