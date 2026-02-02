import { createApiClient } from "@repo/api";
import { getDefaultApiUrl } from "./network.js";

// Use environment variable if available, otherwise default to local server
const BASE_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();

export const api = createApiClient({
  baseUrl: BASE_URL,
});
