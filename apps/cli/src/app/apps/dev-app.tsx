import React from "react";
import { config } from "../../config.js";
import { useExitHandler } from "../../hooks/use-exit-handler.js";
import { useServer } from "../../hooks/use-server.js";
import { StatusDisplay } from "../../components/ui/status-display.js";
import { createApiServer } from "../../lib/servers/api-server.js";
import { createWebServer } from "../../lib/servers/web-server.js";

export function DevApp(): React.ReactElement {
  useServer(() =>
    createApiServer({
      cwd: config.paths.server,
      port: config.ports.api,
    }),
  );
  useServer(() =>
    createWebServer({
      cwd: config.paths.web,
      port: config.ports.web,
    }),
  );

  useExitHandler();

  return <StatusDisplay />;
}
