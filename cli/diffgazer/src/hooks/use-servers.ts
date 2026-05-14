import { useEffect, useState } from "react";
import type { ServerController } from "../lib/servers/create-process-server.js";

const activeServerSets = new Set<readonly ServerController[]>();

export async function stopAllServers(): Promise<void> {
  const snapshots = [...activeServerSets];
  activeServerSets.clear();
  await Promise.allSettled(
    snapshots.flatMap((servers) => servers.map((server) => server.stop())),
  );
}

export function useServers(
  createServers: ReadonlyArray<() => ServerController>,
): void {
  const [servers] = useState(() => createServers.map((create) => create()));

  useEffect(() => {
    servers.forEach((server) => server.start());
    activeServerSets.add(servers);
    return () => {
      servers.forEach((server) => {
        void server.stop();
      });
      activeServerSets.delete(servers);
    };
  }, [servers]);
}
