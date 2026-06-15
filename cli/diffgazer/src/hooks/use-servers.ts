import { useEffect, useState } from "react";
import type { ServerController } from "../lib/servers/process";
import { activeServerSets } from "../lib/servers/stop-all";

export interface ServerControls {
  /** Re-invoke start() on every controller; idle/stopped controllers re-listen. */
  restartServers: () => void;
}

export function useServers(createServers: ReadonlyArray<() => ServerController>): ServerControls {
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

  return {
    restartServers: () => {
      for (const server of servers) {
        server.start();
      }
    },
  };
}
