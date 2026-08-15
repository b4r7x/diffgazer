import { ExecutionLeaseRegistry } from "./ai/admission/service.js";
import type { ConfigurationLeaseHooks } from "./config/seams.js";

export interface SessionCancelOptions {
  provider?: string;
  message?: string;
  reason?: string;
  configurationId?: string;
  configurationRevision?: number;
  admittedExecutionFingerprint?: string;
}

export interface RegisteredSession {
  projectKey: string;
  configurationId?: string | null;
  configurationRevision?: number | null;
  admittedExecutionFingerprint?: string | null;
  leaseId?: string | null;
  cancel: (options?: SessionCancelOptions) => void;
}

const registry = new Map<string, RegisteredSession>();
const projectGenerations = new Map<string, number>();

/**
 * Process-wide configuration-lease authority. Admission acquires leases here,
 * session activation attaches cancellation to them, and configuration deletion
 * revokes, cancels, and drains against the same set.
 */
const leaseAuthority = new ExecutionLeaseRegistry();

export function getConfigurationLeaseAuthority(): ExecutionLeaseRegistry {
  return leaseAuthority;
}

export function resetConfigurationLeaseRegistryForTests(): void {
  leaseAuthority.reset();
}

export function getProjectSessionGeneration(projectKey: string): number {
  return projectGenerations.get(projectKey) ?? 0;
}

export function activateSessionForProject<T>(
  projectKey: string,
  generation: number,
  isAuthorized: () => boolean,
  activate: () => T,
): T | null {
  if (getProjectSessionGeneration(projectKey) !== generation || !isAuthorized()) return null;
  return activate();
}

export function registerSession(sessionId: string, session: RegisteredSession): void {
  registry.set(sessionId, session);
  const { configurationId, leaseId } = session;
  if (!configurationId || !leaseId) return;
  leaseAuthority.attachCancel(configurationId, leaseId, () =>
    session.cancel({
      configurationId,
      configurationRevision: session.configurationRevision ?? undefined,
      admittedExecutionFingerprint: session.admittedExecutionFingerprint ?? undefined,
    }),
  );
}

export function unregisterSession(sessionId: string): void {
  const session = registry.get(sessionId);
  registry.delete(sessionId);
  if (!session?.configurationId || !session.leaseId) return;
  leaseAuthority.detachCancel(session.configurationId, session.leaseId);
}

export function cancelSessionsForProject(
  projectPath: string,
  options?: SessionCancelOptions,
): void {
  for (const session of registry.values()) {
    if (session.projectKey !== projectPath) continue;
    session.cancel(options);
  }
}

/**
 * Fail-closed deletion hooks. A drain that times out leaves live work holding
 * the credentials, so the hook clears the revocation and throws: the config
 * action fails instead of deleting secret material out from under an execution.
 */
export function createConfigurationLeaseHooks(): ConfigurationLeaseHooks {
  return {
    revoke: (configurationId) => {
      leaseAuthority.revoke(configurationId);
    },
    cancel: (configurationId) => {
      leaseAuthority.cancel(configurationId);
    },
    drain: async (configurationId) => {
      const outcome = await leaseAuthority.drain(configurationId);
      if (outcome === "drained") return;
      leaseAuthority.clearRevocation(configurationId);
      throw new Error(
        `Configuration ${configurationId} still has active executions after drain timeout`,
      );
    },
    clearRevocation: (configurationId) => {
      leaseAuthority.clearRevocation(configurationId);
    },
  };
}

// The registry is process-local. Packaged CLIs normally own one embedded server;
// immediate invalidation across multiple server processes would require a durable
// provider generation or IPC broadcast in addition to this synchronous cancellation.
export function revokeProjectSessions(projectPath: string, options?: SessionCancelOptions): void {
  projectGenerations.set(projectPath, getProjectSessionGeneration(projectPath) + 1);
  cancelSessionsForProject(projectPath, options);
}
