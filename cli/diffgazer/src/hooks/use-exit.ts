import { getErrorMessage } from "@diffgazer/core/errors";
import { useApp } from "ink";
import { createContext, type MutableRefObject, useContext, useEffect } from "react";
import { config } from "../config";
import { reportToTerminal } from "../lib/report-to-terminal";
import { stopAllServers } from "../lib/servers/stop-all";
import { stopWithTimeout } from "../lib/stop-with-timeout";

export type ExitPreparation = () => Promise<void>;
export type ExitProcess = (code: number) => void;

interface ExitPreparationContextValue {
  preparationRef: MutableRefObject<ExitPreparation | null>;
}

export const ExitPreparationContext = createContext<ExitPreparationContextValue | null>(null);

export function useRegisterExitPreparation(prepare: ExitPreparation): void {
  const context = useContext(ExitPreparationContext);
  const preparationRef = context?.preparationRef;

  useEffect(() => {
    if (!preparationRef) return;
    preparationRef.current = prepare;
    return () => {
      if (preparationRef.current === prepare) preparationRef.current = null;
    };
  }, [preparationRef, prepare]);
}

export function useExit(): { handleExit: () => void } {
  const { exit } = useApp();
  const context = useContext(ExitPreparationContext);

  const handleExit = () => {
    shutdownAndExit(exit, undefined, async () => {
      await context?.preparationRef.current?.();
    }).catch((error: unknown) => {
      exit(error instanceof Error ? error : new Error(String(error)));
    });
  };

  return { handleExit };
}

let shutdownPromise: Promise<void> | undefined;

export function __resetShutdownPromiseForTests(): void {
  shutdownPromise = undefined;
}

export function shutdownAndExit(
  exitInk: () => void,
  exitProcess: ExitProcess = (code) => process.exit(code),
  beforeShutdown?: ExitPreparation,
): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  let exitCode = 0;
  shutdownPromise = (async () => {
    try {
      await beforeShutdown?.();
      await stopWithTimeout(stopAllServers, config.shutdown.gracefulMs);
    } catch (error) {
      // The memo is what makes repeated Ctrl-C idempotent; holding a rejected
      // one would make a single failed preparation refuse every later attempt.
      shutdownPromise = undefined;
      exitCode = 1;
      // The finally below terminates the process, so a caller's rejection
      // handler never runs: this is the last point a failed cleanup can be seen.
      reportToTerminal(`Shutdown failed: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      // Ink restores the terminal from raw mode on unmount, so it must run even
      // when the preparation threw.
      exitInk();
      exitProcess(exitCode);
    }
  })();
  return shutdownPromise;
}
