import { createApi } from "@stargazer/api";
import { getDefaultApiUrl } from "./network";

const BASE_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();

export const api = createApi({
  baseUrl: BASE_URL,
});
