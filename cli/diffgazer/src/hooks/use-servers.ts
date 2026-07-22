import { useEffect, useState } from "react";
import type { ServerController } from "../lib/servers/controller";
import { registerServerSet } from "../lib/servers/stop-all";

export interface ServerControls {
  /** Re-invoke start() on every controller; idle/stopped controllers re-listen. */
  restartServers: () => Promise<void>;
}

export function useServers(createServers: ReadonlyArray<() => ServerController>): ServerControls {
  const [servers] = useState(() => createServers.map((create) => create()));

  useEffect(() => {
    for (const server of servers) {
      void server.start().catch(() => undefined);
    }
    const stopServers = registerServerSet(servers);
    return () => {
      void stopServers();
    };
  }, [servers]);

  return {
    restartServers: () =>
      Promise.all(servers.map((server) => server.start())).then(() => undefined),
  };
}
