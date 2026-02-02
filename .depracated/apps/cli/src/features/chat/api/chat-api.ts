import { api } from "../../../lib/api.js";

export interface SendMessageRequest {
  sessionId: string;
  message: string;
  signal?: AbortSignal;
}

export async function sendChatMessage({ sessionId, message, signal }: SendMessageRequest): Promise<Response> {
  return api().request("POST", `/sessions/${sessionId}/chat`, {
    body: { message },
    signal,
  });
}
