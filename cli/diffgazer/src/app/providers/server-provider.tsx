import type { ReactNode } from "react";
import { useExitHandler } from "../../hooks/use-exit-handler";
import { useServers } from "../../hooks/use-servers";
import type { ServerController } from "../../lib/servers/create-process-server";

interface ServerProviderProps {
  children: ReactNode;
  servers: ReadonlyArray<() => ServerController>;
}

export function ServerProvider({ children, servers }: ServerProviderProps) {
  useServers(servers);
  useExitHandler();

  return <>{children}</>;
}
