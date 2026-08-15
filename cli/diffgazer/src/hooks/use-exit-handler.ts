import { useInput } from "ink";
import { useEffect, useEffectEvent } from "react";
import { SHUTDOWN_SIGNALS } from "../lib/shutdown-signals";
import { useExit } from "./use-exit";

interface ExitHandlerOptions {
  onExit?: () => void;
}

export function useExitHandler(options: ExitHandlerOptions = {}): void {
  const { onExit } = options;
  const { handleExit: exit } = useExit();

  const handleExit = useEffectEvent(() => {
    onExit?.();
    exit();
  });

  useEffect(() => {
    for (const signal of SHUTDOWN_SIGNALS) {
      process.on(signal, handleExit);
    }

    return () => {
      for (const signal of SHUTDOWN_SIGNALS) {
        process.off(signal, handleExit);
      }
    };
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      handleExit();
    }
  });
}
