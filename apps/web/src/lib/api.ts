import { createApi } from "@diffgazer/core/api";

declare global {
  interface Window {
    __DIFFGAZER_SHUTDOWN_TOKEN__?: string;
  }
}

function getDefaultApiUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://127.0.0.1:3000";
}

function getShutdownToken(): string | undefined {
  return (typeof window !== "undefined" ? window.__DIFFGAZER_SHUTDOWN_TOKEN__ : undefined)
    || import.meta.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
}

const BASE_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();

export const api = createApi({
  baseUrl: BASE_URL,
  shutdownToken: getShutdownToken,
});
