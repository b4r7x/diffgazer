import { useEffectEvent } from "react";
import { useApp } from "ink";
import { stopAllServers } from "./use-servers.js";

export function useExit(): { handleExit: () => void } {
  const { exit } = useApp();

  const handleExit = useEffectEvent(() => {
    stopAllServers();
    exit();
    setTimeout(() => process.exit(0), 100);
  });

  return { handleExit };
}
