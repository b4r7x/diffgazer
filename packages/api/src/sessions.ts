import type {
  ApiClient,
  SessionsListResponse,
  SessionResponse,
  SessionMessageResponse,
  SessionDeleteResponse,
} from "./types.js";

export async function listSessions(
  client: ApiClient,
  projectPath?: string
): Promise<SessionsListResponse> {
  const params = projectPath ? { projectPath } : undefined;
  return client.get<SessionsListResponse>("/api/sessions", params);
}

export async function getLastSession(
  client: ApiClient,
  projectPath: string
): Promise<SessionResponse> {
  return client.get<SessionResponse>("/api/sessions/last", { projectPath });
}

export async function getSession(client: ApiClient, id: string): Promise<SessionResponse> {
  return client.get<SessionResponse>(`/api/sessions/${id}`);
}

export async function createSession(
  client: ApiClient,
  input: { projectPath: string; title?: string }
): Promise<SessionResponse> {
  return client.post<SessionResponse>("/api/sessions", input);
}

export async function addSessionMessage(
  client: ApiClient,
  id: string,
  input: { role: string; content: string }
): Promise<SessionMessageResponse> {
  return client.post<SessionMessageResponse>(`/api/sessions/${id}/messages`, input);
}

export async function deleteSession(
  client: ApiClient,
  id: string
): Promise<SessionDeleteResponse> {
  return client.delete<SessionDeleteResponse>(`/api/sessions/${id}`);
}

export async function streamSessionChat(
  client: ApiClient,
  id: string,
  input: { message: string },
  options: { signal?: AbortSignal } = {}
): Promise<Response> {
  return client.request("POST", `/api/sessions/${id}/chat`, {
    body: input,
    signal: options.signal,
  });
}

export const bindSessions = (client: ApiClient) => ({
  listSessions: (projectPath?: string) => listSessions(client, projectPath),
  getLastSession: (projectPath: string) => getLastSession(client, projectPath),
  getSession: (id: string) => getSession(client, id),
  createSession: (input: { projectPath: string; title?: string }) =>
    createSession(client, input),
  addSessionMessage: (id: string, input: { role: string; content: string }) =>
    addSessionMessage(client, id, input),
  deleteSession: (id: string) => deleteSession(client, id),
  streamSessionChat: (
    id: string,
    input: { message: string },
    options?: { signal?: AbortSignal }
  ) => streamSessionChat(client, id, input, options),
});
