import { useEffect, useState } from "react";
import type { ServerController } from "../lib/servers/create-process-server.js";

export function useServers(
  createServers: ReadonlyArray<() => ServerController>,
): void {
  const [servers] = useState(() => createServers.map((create) => create()));

  useEffect(() => {
    servers.forEach((server) => server.start());
    return () => {
      servers.forEach((server) => server.stop());
    };
  }, [servers]);
}
