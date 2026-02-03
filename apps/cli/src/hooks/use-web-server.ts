import { useSyncExternalStore, useEffect } from "react";
import { createWebServer } from "../lib/web-server.js";
import { type ServerState } from "../lib/create-process-server.js";
import { config } from "../config.js";

const webServer = createWebServer({
  cwd: config.paths.web,
  port: config.ports.web,
});

export function useWebServer(): ServerState {
  useEffect(() => {
    return () => webServer.stop();
  }, []);

  return useSyncExternalStore(webServer.subscribe, webServer.getSnapshot);
}
