import type { AgentStreamEvent } from "@repo/schemas";

export interface TriageOptions {
  scope?: string;
  focus?: string[];
}

interface StreamCallbacks {
  onEvent: (event: AgentStreamEvent) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

export function streamTriage(options: TriageOptions, callbacks: StreamCallbacks): () => void {
  const params = new URLSearchParams();
  if (options.scope) params.append("scope", options.scope);
  if (options.focus?.length) params.append("focus", options.focus.join(","));

  const baseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:3847";
  const url = `${baseUrl}/triage/stream?${params.toString()}`;
  
  const eventSource = new EventSource(url);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      callbacks.onEvent(data as AgentStreamEvent);
    } catch {
      // Ignore malformed events
    }
  };

  eventSource.onerror = () => {
    callbacks.onError(new Error("EventSource connection error"));
    eventSource.close();
  };

  eventSource.addEventListener("complete", () => {
    callbacks.onComplete();
    eventSource.close();
  });

  eventSource.addEventListener("error", (e) => {
    const target = e as MessageEvent;
    try {
      const data = JSON.parse(target.data);
      callbacks.onError(new Error(data.message || "Unknown stream error"));
    } catch {
      callbacks.onError(new Error("Stream error"));
    }
    eventSource.close();
  });

  return () => {
    eventSource.close();
  };
}
