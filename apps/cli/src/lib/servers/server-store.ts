export type ServerStatus = "idle" | "starting" | "running" | "error";

export interface ServerState {
  status: ServerStatus;
  address: string | null;
  error: string | null;
}

export interface ServerStateStore {
  getSnapshot: () => ServerState;
  subscribe: (callback: () => void) => () => void;
  setState: (next: ServerState) => void;
  setIdle: () => void;
}

export function createServerStateStore(): ServerStateStore {
  const listeners = new Set<() => void>();
  let state: ServerState = { status: "idle", address: null, error: null };

  function emit(): void {
    listeners.forEach((cb) => cb());
  }

  function setState(next: ServerState): void {
    state = next;
    emit();
  }

  function setIdle(): void {
    setState({ status: "idle", address: null, error: null });
  }

  return {
    getSnapshot: () => state,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    setState,
    setIdle,
  };
}
