export interface SessionCancelOptions {
  provider?: string;
  message?: string;
  reason?: string;
}

export interface RegisteredSession {
  projectKey: string;
  cancel: (options?: SessionCancelOptions) => void;
}

const registry = new Map<string, RegisteredSession>();
const projectGenerations = new Map<string, number>();

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
}

export function unregisterSession(sessionId: string): void {
  registry.delete(sessionId);
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

// The registry is process-local. Packaged CLIs normally own one embedded server;
// immediate invalidation across multiple server processes would require a durable
// provider generation or IPC broadcast in addition to this synchronous cancellation.
export function cancelSessionsForProvider(
  provider: string,
  options?: Omit<SessionCancelOptions, "provider">,
): void {
  for (const session of registry.values()) {
    session.cancel({ ...options, provider });
  }
}

export function revokeProjectSessions(projectPath: string, options?: SessionCancelOptions): void {
  projectGenerations.set(projectPath, getProjectSessionGeneration(projectPath) + 1);
  cancelSessionsForProject(projectPath, options);
}
