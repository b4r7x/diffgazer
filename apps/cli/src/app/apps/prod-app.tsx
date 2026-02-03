import React from "react";
import open from "open";
import { config } from "../../config.js";
import { useExitHandler } from "../../hooks/use-exit-handler.js";
import { useServer } from "../../hooks/use-server.js";
import { StatusDisplay } from "../../components/ui/status-display.js";
import { createEmbeddedServer } from "../../lib/servers/embedded-server.js";

export function ProdApp(): React.ReactElement {
  useServer(() =>
    createEmbeddedServer({
      port: Number(process.env.PORT) || config.ports.api,
      onReady: (address) => void open(address),
    }),
  );

  useExitHandler();

  return <StatusDisplay />;
}
