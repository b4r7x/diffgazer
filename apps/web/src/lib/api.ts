import { createApi } from "@stargazer/api";

function getDefaultApiUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://127.0.0.1:3000";
}

const BASE_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();

export const api = createApi({
  baseUrl: BASE_URL,
});
