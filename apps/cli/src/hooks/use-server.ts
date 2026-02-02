import { useSyncExternalStore, useEffect } from "react";
import type { ProcessServer, ServerState } from "../lib/create-process-server.js";

export function useServer(server: ProcessServer): ServerState {
  useEffect(() => () => server.stop(), [server]);
  return useSyncExternalStore(server.subscribe, server.getSnapshot);
}
