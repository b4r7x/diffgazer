import { api } from "@/lib/api";
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
  // Convert options to query params
  const params = new URLSearchParams();
  if (options.scope) params.append("scope", options.scope);
  if (options.focus?.length) params.append("focus", options.focus.join(","));
  
  // Use the raw EventSource API since createApiClient helper might not support SSE streaming directly/cleanly yet
  // or we can use `api.stream` if implemented, but the workflow spec suggests using EventSource directly is fine for SSE.
  // The workflow says "Uses EventSource".
  // Let's assume we need to construct the URL manually or use api.stream if it returns an EventSource?
  // Looking at api.ts, api.stream returns a fetch promise which is not SSE.
  // So we construct URL manually using base URL from api.ts (we need to export it or just use the same logic).
  
  const baseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:3847";
  const url = `${baseUrl}/triage/stream?${params.toString()}`;
  
  const eventSource = new EventSource(url);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Check if it's a completion event or error event structure if strictly defined,
      // but usually stream events are the AgentStreamEvent.
      // We'll trust the schema.
      callbacks.onEvent(data as AgentStreamEvent);
    } catch {
      // Silently ignore malformed events
    }
  };
  
  eventSource.onerror = (e) => {
    // EventSource error handling is tricky, often it just reconnects.
    // But if we get a fatal error or close, we should notify.
    // For now, pass to onError.
    callbacks.onError(new Error("EventSource connection error"));
    eventSource.close();
  };
  
  eventSource.addEventListener("complete", () => {
    callbacks.onComplete();
    eventSource.close();
  });
  
  eventSource.addEventListener("error", (e) => {
      // Custom error event from server
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
