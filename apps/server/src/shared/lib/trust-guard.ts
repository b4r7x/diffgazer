import type { Context, Next } from "hono";
import { ErrorCode } from "@stargazer/schemas/errors";
import { getProjectInfo } from "./config-store/store.js";
import { getProjectRoot } from "./request.js";
import { errorResponse } from "./response.js";

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
