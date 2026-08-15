const SIGNAL_EXIT_CODES: Partial<Record<NodeJS.Signals, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

export interface MutationCancellation {
  controller: AbortController;
  receivedSignal: { current: NodeJS.Signals | null };
  dispose: () => void;
}

export function installMutationCancellationHandlers(): MutationCancellation {
  const controller = new AbortController();
  const receivedSignal = { current: null as NodeJS.Signals | null };

  const onSignal = (signal: NodeJS.Signals) => {
    if (receivedSignal.current) return;
    receivedSignal.current = signal;
    controller.abort(new Error(`Install cancelled by ${signal}`));
  };

  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");

  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  return {
    controller,
    receivedSignal,
    dispose: () => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    },
  };
}

export function throwIfMutationCancelled(cancellation: MutationCancellation): void {
  const signal = cancellation.receivedSignal.current;
  if (!signal) return;
  throw cancellation.controller.signal.reason ?? new Error(`Install cancelled by ${signal}`);
}

export function exitAfterSignalCancellation(signal: NodeJS.Signals): never {
  process.exit(SIGNAL_EXIT_CODES[signal] ?? 1);
}
