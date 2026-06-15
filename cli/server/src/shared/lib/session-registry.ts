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
