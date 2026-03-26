import { useEffect, useEffectEvent } from "react";
import { useApp, useInput } from "ink";
import { stopAllServers } from "./use-servers.js";

interface ExitHandlerOptions {
  onExit?: () => void;
}

export function useExitHandler(options: ExitHandlerOptions = {}): void {
  const { onExit } = options;
  const { exit } = useApp();

  const handleExit = useEffectEvent(() => {
    onExit?.();
    stopAllServers();
    exit();
    setTimeout(() => process.exit(0), 100);
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
