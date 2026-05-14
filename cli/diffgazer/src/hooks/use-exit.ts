import { useEffectEvent } from "react";
import { useApp } from "ink";
import { stopAllServers } from "./use-servers.js";

const SHUTDOWN_TIMEOUT_MS = 3000;

export function useExit(): { handleExit: () => void } {
  const { exit } = useApp();

  const handleExit = useEffectEvent(() => {
    exit();
    void shutdownAndExit();
  });

  return { handleExit };
}

async function shutdownAndExit(): Promise<void> {
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS);
  });
  await Promise.race([stopAllServers(), timeout]);
  process.exit(0);
}
