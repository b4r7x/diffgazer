import { useSyncExternalStore, useEffect } from "react";
import { createApiServer, type ApiServerState } from "../lib/api-server.js";
import { config } from "../config.js";

const apiServer = createApiServer({
  cwd: config.paths.server,
  port: config.ports.api,
});

interface UseApiServerOptions {
  onExit: () => void;
}

export function useApiServer({ onExit }: UseApiServerOptions): ApiServerState {
  useEffect(() => {
    function handleExit(): void {
      apiServer.stop();
      onExit();
      setTimeout(() => process.exit(0), 100);
    }

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    return () => {
      apiServer.stop();
      process.off("SIGINT", handleExit);
      process.off("SIGTERM", handleExit);
    };
  }, [onExit]);

  return useSyncExternalStore(apiServer.subscribe, apiServer.getSnapshot);
}

export type { ApiServerState } from "../lib/api-server.js";
