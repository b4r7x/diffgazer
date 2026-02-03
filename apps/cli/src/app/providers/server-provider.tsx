import React from "react";
import { useExitHandler } from "../../hooks/use-exit-handler.js";
import { useServers } from "../../hooks/use-servers.js";
import type { ServerController } from "../../lib/servers/create-process-server.js";

interface ServerProviderProps {
  children: React.ReactNode;
  servers: ReadonlyArray<() => ServerController>;
}

export function ServerProvider({ children, servers }: ServerProviderProps) {
  useServers(servers);
  useExitHandler();

  return <>{children}</>;
}
