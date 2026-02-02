import { useSyncExternalStore, useEffect } from "react";
import { createWebServer, type WebServerState } from "../lib/web-server.js";
import { config } from "../config.js";

const webServer = createWebServer({
  cwd: config.paths.web,
  port: config.ports.web,
});

export function useWebServer(): WebServerState {
  useEffect(() => {
    return () => webServer.stop();
  }, []);

  return useSyncExternalStore(webServer.subscribe, webServer.getSnapshot);
}

export type { WebServerState } from "../lib/web-server.js";
