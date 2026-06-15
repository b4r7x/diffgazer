import { useStdout } from "ink";
import { useCallback, useSyncExternalStore } from "react";
import {
  buildResponsiveResult,
  getBreakpointTier,
  type ResponsiveResult,
} from "../lib/breakpoints.js";

interface TerminalDimensions {
  columns: number;
  rows: number;
}

type ResponsiveDimensions = TerminalDimensions & ResponsiveResult;

interface StreamStore {
  subscribers: Set<() => void>;
  snapshot: TerminalDimensions;
  onResize: () => void;
}

const stores = new WeakMap<NodeJS.WriteStream, StreamStore>();

function readDimensions(stdout: NodeJS.WriteStream): TerminalDimensions {
  return { columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 };
}

function getStore(stdout: NodeJS.WriteStream): StreamStore {
  const existing = stores.get(stdout);
  if (existing) return existing;

  const store: StreamStore = {
    subscribers: new Set(),
    snapshot: readDimensions(stdout),
    onResize() {
      const next = readDimensions(stdout);
      // Replace the snapshot only on an actual change so getSnapshot returns a
      // stable reference between renders (required by useSyncExternalStore).
      if (next.columns === store.snapshot.columns && next.rows === store.snapshot.rows) {
        return;
      }
      store.snapshot = next;
      for (const notify of store.subscribers) notify();
    },
  };
  stores.set(stdout, store);
  return store;
}

function subscribe(stdout: NodeJS.WriteStream, onStoreChange: () => void): () => void {
  const store = getStore(stdout);
  // The first subscriber attaches the single shared resize listener.
  if (store.subscribers.size === 0) {
    stdout.on("resize", store.onResize);
  }
  store.subscribers.add(onStoreChange);
  return () => {
    store.subscribers.delete(onStoreChange);
    // The last subscriber detaches the listener and drops the store.
    if (store.subscribers.size === 0) {
      stdout.off("resize", store.onResize);
      stores.delete(stdout);
    }
  };
}

export function useTerminalDimensions(): TerminalDimensions {
  const { stdout } = useStdout();
  // Stabilize the store callbacks per stream so React keeps one subscription
  // across renders. Inline closures re-subscribe every render; under Ink 7's
  // reconciler the resulting store teardown/recreate hands useSyncExternalStore
  // a fresh snapshot reference each render and spins into an update loop.
  const subscribeToStdout = useCallback(
    (onStoreChange: () => void) => subscribe(stdout, onStoreChange),
    [stdout],
  );
  const getSnapshot = useCallback(() => getStore(stdout).snapshot, [stdout]);
  return useSyncExternalStore(subscribeToStdout, getSnapshot);
}

export function useResponsive(): ResponsiveDimensions {
  const { columns, rows } = useTerminalDimensions();
  const tier = getBreakpointTier(columns);
  return { columns, rows, ...buildResponsiveResult(tier) };
}
