import type { ReactNode } from "react";
import { useServers } from "../../hooks/use-servers";
import type { ServerController } from "../../lib/servers/process";
import { useExitHandler } from "./use-exit-handler";

interface ServerProviderProps {
  children: ReactNode;
  servers: ReadonlyArray<() => ServerController>;
}

export function ServerProvider({ children, servers }: ServerProviderProps) {
  useServers(servers);
  useExitHandler();

  return <>{children}</>;
}
