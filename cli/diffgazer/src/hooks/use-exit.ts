import { useApp } from "ink";
import { config } from "../config";
import { stopAllServers } from "../lib/servers/stop-all";
import { stopWithTimeout } from "../lib/stop-with-timeout";

export function useExit(): { handleExit: () => void } {
  const { exit } = useApp();

  const handleExit = () => {
    exit();
    void shutdownAndExit();
  };

  return { handleExit };
}

async function shutdownAndExit(): Promise<void> {
  await stopWithTimeout(stopAllServers, config.shutdown.gracefulMs);
  process.exit(0);
}
