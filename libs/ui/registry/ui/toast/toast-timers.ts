export interface ToastTimerSnapshot {
  /** Duration in milliseconds. */
  duration: number;
  /** Remaining time in milliseconds. */
  remaining: number;
  /** Timestamp when the timer started. */
  startedAt: number;
}

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type SetTimeoutFn = (fn: () => void, ms: number) => TimeoutHandle;
type ClearTimeoutFn = (handle: TimeoutHandle) => void;

interface TimerEntry {
  timeout: TimeoutHandle | undefined;
  startedAt: number;
  remaining: number;
  duration: number;
}

export interface ToastTimers {
  schedule(id: string, duration: number, deferTimeout?: boolean): void;
  clear(id: string): void;
  pause(): void;
  resume(): void;
  snapshot(id: string): ToastTimerSnapshot | null;
  readonly version: number;
}

export function createToastTimers(deps: {
  onElapsed: (id: string) => void;
  now?: () => number;
  setTimeout?: SetTimeoutFn;
  clearTimeout?: ClearTimeoutFn;
}): ToastTimers {
  const now = deps.now ?? Date.now;
  const setTimeoutFn: SetTimeoutFn = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimeoutFn: ClearTimeoutFn = deps.clearTimeout ?? ((handle) => clearTimeout(handle));

  const entries = new Map<string, TimerEntry>();
  let version = 0;
  let paused = false;

  function markChanged() {
    version += 1;
  }

  function clear(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    if (entry.timeout !== undefined) clearTimeoutFn(entry.timeout);
    entries.delete(id);
    markChanged();
  }

  function schedule(id: string, duration: number, deferTimeout = false) {
    const existing = entries.get(id);
    if (existing?.timeout !== undefined) clearTimeoutFn(existing.timeout);
    const entry: TimerEntry = {
      timeout:
        paused || deferTimeout ? undefined : setTimeoutFn(() => deps.onElapsed(id), duration),
      startedAt: now(),
      remaining: duration,
      duration,
    };
    entries.set(id, entry);
    markChanged();
  }

  function pause() {
    let changed = false;
    for (const entry of entries.values()) {
      if (entry.timeout !== undefined) {
        clearTimeoutFn(entry.timeout);
        entry.timeout = undefined;
        changed = true;
      }
      const nextRemaining = Math.max(0, entry.remaining - (now() - entry.startedAt));
      if (nextRemaining !== entry.remaining) changed = true;
      entry.remaining = nextRemaining;
    }
    paused = true;
    if (changed) markChanged();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    for (const [id, entry] of entries) {
      entry.startedAt = now();
      entry.timeout = setTimeoutFn(() => deps.onElapsed(id), entry.remaining);
    }
    if (entries.size > 0) markChanged();
  }

  function snapshot(id: string): ToastTimerSnapshot | null {
    const entry = entries.get(id);
    if (!entry) return null;
    return {
      duration: entry.duration,
      remaining: entry.remaining,
      startedAt: entry.startedAt,
    };
  }

  return {
    schedule,
    clear,
    pause,
    resume,
    snapshot,
    get version() {
      return version;
    },
  };
}
