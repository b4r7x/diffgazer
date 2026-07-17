import { createApi, SHUTDOWN_TOKEN_GLOBAL } from "@diffgazer/core/api";
import { buildLocalhostOrigin, DEFAULT_API_PORT } from "@diffgazer/core/env";
import { resolveApiEndpoint } from "@/lib/api-endpoint";

function getDefaultApiUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return buildLocalhostOrigin(DEFAULT_API_PORT);
}

function getShutdownToken(): string | undefined {
  return (
    (typeof window !== "undefined" ? window[SHUTDOWN_TOKEN_GLOBAL] : undefined) ||
    import.meta.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN
  );
}

const BASE_URL = resolveApiEndpoint(import.meta.env.VITE_API_URL, getDefaultApiUrl());

export const api = createApi({
  baseUrl: BASE_URL,
  shutdownToken: getShutdownToken,
});
