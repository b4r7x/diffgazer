import type { Context, Next } from "hono";
import { ErrorCode } from "@stargazer/schemas/errors";
import { getProjectInfo } from "../lib/config/store.js";
import { getProjectRoot } from "../lib/http/request.js";
import { errorResponse } from "../lib/http/response.js";

export const requireRepoAccess = async (
  c: Context,
  next: Next
): Promise<Response | void> => {
  const projectRoot = getProjectRoot(c);
  const { trust } = getProjectInfo(projectRoot);

  if (!trust?.capabilities.readFiles) {
    return errorResponse(
      c,
      "Repository access not granted. Update Trust & Permissions to continue.",
      ErrorCode.TRUST_REQUIRED,
      403
    );
  }

  await next();
};
