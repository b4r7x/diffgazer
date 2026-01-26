import { createApiClient } from "@repo/api";

// Use environment variable if available, otherwise default to local server
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3847";

export const api = createApiClient({
  baseUrl: BASE_URL,
});
