import { createApi, SHUTDOWN_TOKEN_GLOBAL } from "@diffgazer/core/api";
import { resolveApiEndpoint } from "@/lib/api-endpoint";

function getShutdownToken(): string | undefined {
  return window[SHUTDOWN_TOKEN_GLOBAL] || import.meta.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
}

const BASE_URL = resolveApiEndpoint(import.meta.env.VITE_API_URL, window.location.origin);

export const api = createApi({
  baseUrl: BASE_URL,
  shutdownToken: getShutdownToken,
});
