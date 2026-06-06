import { type BoundApi, createApi } from "@diffgazer/core/api";
import { parsePortEnv } from "@diffgazer/core/env";
import { config } from "../config";
import { ensureShutdownToken } from "./shutdown-token";

const shutdownToken = ensureShutdownToken();
const port = parsePortEnv(process.env.PORT, config.ports.api);

export const api: BoundApi = createApi({
  baseUrl: `http://127.0.0.1:${String(port)}`,
  projectRoot: process.cwd(),
  shutdownToken,
});
