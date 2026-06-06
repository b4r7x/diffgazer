import type { ServerController } from "./process";

export const activeServerSets = new Set<readonly ServerController[]>();

export async function stopAllServers(): Promise<void> {
  const snapshots = [...activeServerSets];
  activeServerSets.clear();
  await Promise.allSettled(
    snapshots.flatMap((servers) => servers.map((server) => server.stop())),
  );
}
