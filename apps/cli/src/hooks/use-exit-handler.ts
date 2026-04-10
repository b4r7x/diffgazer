import { useEffect, useEffectEvent } from "react";
import { useInput } from "ink";
import { useExit } from "./use-exit.js";

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
    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    return () => {
      process.off("SIGINT", handleExit);
      process.off("SIGTERM", handleExit);
    };
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      handleExit();
    }
  });
}
