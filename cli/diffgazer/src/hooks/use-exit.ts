import { useApp } from "ink";
import {
  createContext,
  createElement,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { config } from "../config";
import { stopAllServers } from "../lib/servers/stop-all";
import { stopWithTimeout } from "../lib/stop-with-timeout";

type ExitPreparation = () => Promise<void>;
type ExitProcess = () => void;

interface ExitPreparationContextValue {
  preparationRef: MutableRefObject<ExitPreparation | null>;
  exitProcess?: ExitProcess;
}

const ExitPreparationContext = createContext<ExitPreparationContextValue | null>(null);

export function ExitPreparationProvider({
  children,
  exitProcess,
}: {
  children: ReactNode;
  exitProcess?: ExitProcess;
}) {
  const preparationRef = useRef<ExitPreparation | null>(null);
  return createElement(
    ExitPreparationContext,
    { value: { preparationRef, exitProcess } },
    children,
  );
}

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
    void shutdownAndExit(exit, context?.exitProcess, async () => {
      await context?.preparationRef.current?.();
    });
  };

  return { handleExit };
}

let shutdownPromise: Promise<void> | undefined;

export function shutdownAndExit(
  exitInk: () => void,
  exitProcess: ExitProcess = () => process.exit(0),
  beforeShutdown?: ExitPreparation,
): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    await beforeShutdown?.();
    await stopWithTimeout(stopAllServers, config.shutdown.gracefulMs);
    exitInk();
    exitProcess();
  })();
  return shutdownPromise;
}
