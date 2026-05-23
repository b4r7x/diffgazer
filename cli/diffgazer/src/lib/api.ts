import { createApi, type BoundApi } from "@diffgazer/core/api";
import { config } from "../config.js";
import { parsePortEnv } from "./servers/server-factories.js";
import { ensureShutdownToken } from "./shutdown-token.js";

const shutdownToken = ensureShutdownToken();
const port = parsePortEnv(process.env.PORT, config.ports.api);

export const api: BoundApi = createApi({
  baseUrl: `http://127.0.0.1:${String(port)}`,
  projectRoot: process.cwd(),
  shutdownToken,
});
