import { createApi, type BoundApi } from "@diffgazer/core/api";
import { ensureShutdownToken } from "./shutdown-token.js";

const shutdownToken = ensureShutdownToken();

export const api: BoundApi = createApi({
  baseUrl: "http://127.0.0.1:3000",
  projectRoot: process.cwd(),
  shutdownToken,
});
