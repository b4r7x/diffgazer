import type { ServerController } from "./process";

interface ServerSetRegistration {
  readonly servers: readonly ServerController[];
  stopPromise: Promise<void> | undefined;
}

export const activeServerSets = new Set<readonly ServerController[]>();
const currentServerSetRegistrations = new WeakMap<
  readonly ServerController[],
  ServerSetRegistration
>();

export function registerServerSet(servers: readonly ServerController[]): () => Promise<void> {
  const registration: ServerSetRegistration = { servers, stopPromise: undefined };
  currentServerSetRegistrations.set(servers, registration);
  activeServerSets.add(servers);
  return () => stopRegistration(registration);
}

export function stopServerSet(servers: readonly ServerController[]): Promise<void> {
  const registration = currentServerSetRegistrations.get(servers);
  return registration ? stopRegistration(registration) : Promise.resolve();
}

function stopRegistration(registration: ServerSetRegistration): Promise<void> {
  if (registration.stopPromise) return registration.stopPromise;

  const serverStops = registration.servers.map((server) =>
    Promise.resolve().then(() => server.stop()),
  );
  const stopPromise = Promise.allSettled(serverStops)
    .then(() => {})
    .finally(() => {
      if (currentServerSetRegistrations.get(registration.servers) === registration) {
        currentServerSetRegistrations.delete(registration.servers);
        activeServerSets.delete(registration.servers);
      }
    });
  registration.stopPromise = stopPromise;
  return stopPromise;
}

export async function stopAllServers(): Promise<void> {
  const snapshots = [...activeServerSets];
  await Promise.allSettled(snapshots.map((servers) => stopServerSet(servers)));
}
