import { useApp } from "ink";
import { useEffectEvent } from "react";
import { config } from "../config";
import { stopAllServers } from "../lib/servers/stop-all";

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
    setTimeout(() => resolve("timeout"), config.shutdown.gracefulMs);
  });
  await Promise.race([stopAllServers(), timeout]);
  process.exit(0);
}
