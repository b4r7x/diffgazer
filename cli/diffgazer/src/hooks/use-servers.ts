import { useEffect, useState } from "react";
import type { ServerController } from "../lib/servers/process";
import { activeServerSets } from "../lib/servers/stop-all";

export function useServers(
  createServers: ReadonlyArray<() => ServerController>,
): void {
  const [servers] = useState(() => createServers.map((create) => create()));

  useEffect(() => {
    for (const server of servers) {
      server.start();
    }
    activeServerSets.add(servers);
    return () => {
      servers.forEach((server) => {
        void server.stop();
      });
      activeServerSets.delete(servers);
    };
  }, [servers]);
}
