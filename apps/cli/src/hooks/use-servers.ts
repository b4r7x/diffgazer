import { useEffect, useState } from "react";
import type { ServerController } from "../lib/servers/create-process-server.js";

// Module-level reference so the exit handler can stop servers synchronously
let activeServers: ServerController[] = [];

export function stopAllServers(): void {
  activeServers.forEach((server) => server.stop());
  activeServers = [];
}

export function useServers(
  createServers: ReadonlyArray<() => ServerController>,
): void {
  const [servers] = useState(() => createServers.map((create) => create()));

  useEffect(() => {
    servers.forEach((server) => server.start());
    activeServers = servers;
    return () => {
      servers.forEach((server) => server.stop());
      activeServers = [];
    };
  }, [servers]);
}
