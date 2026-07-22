import { createContext, type ReactNode, useContext } from "react";
import { useExitHandler } from "../../hooks/use-exit-handler";
import { type ServerControls, useServers } from "../../hooks/use-servers";
import type { ServerController } from "../../lib/servers/controller";

const ServerControlsContext = createContext<ServerControls | null>(null);

interface ServerProviderProps {
  children: ReactNode;
  servers: ReadonlyArray<() => ServerController>;
}

export function ServerProvider({ children, servers }: ServerProviderProps) {
  const controls = useServers(servers);
  useExitHandler();

  return <ServerControlsContext value={controls}>{children}</ServerControlsContext>;
}

export function useServerControls(): ServerControls {
  const ctx = useContext(ServerControlsContext);
  if (!ctx) {
    throw new Error("useServerControls must be used within a ServerProvider");
  }
  return ctx;
}
