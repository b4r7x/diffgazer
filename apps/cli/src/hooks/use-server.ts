import { useEffect, useState, useSyncExternalStore } from "react";
import type { ServerController } from "../lib/servers/create-process-server.js";
import type { ServerState } from "../lib/servers/server-store.js";

export interface UseServerResult {
  controller: ServerController;
  state: ServerState;
}

export function useServer(
  createServer: () => ServerController,
): UseServerResult {
  const [server] = useState(createServer);

  useEffect(() => {
    server.start();
    return () => server.stop();
  }, [server]);

  const state = useSyncExternalStore(server.subscribe, server.getSnapshot);
  return { controller: server, state };
}
