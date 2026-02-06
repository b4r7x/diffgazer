import { bodyLimit } from "hono/body-limit";
import { errorResponse } from "../lib/http/response.js";

export const createBodyLimitMiddleware = (maxSizeKB: number) =>
  bodyLimit({
    maxSize: maxSizeKB * 1024,
    onError: (c) => errorResponse(c, "Request body too large", "PAYLOAD_TOO_LARGE", 413),
  });
