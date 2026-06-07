import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context, Next } from "hono";
import { getStore } from "../lib/config/store.js";
import { getProjectRoot } from "../lib/http/request.js";
import { errorResponse } from "../lib/http/response.js";

export const requireRepoAccess = async (c: Context, next: Next): Promise<Response | undefined> => {
  const projectRoot = getProjectRoot(c);
  const { trust } = getStore().getProjectInfo(projectRoot);

  if (!trust?.capabilities.readFiles) {
    return errorResponse(
      c,
      "Repository access not granted. Update Trust & Permissions to continue.",
      ErrorCode.TRUST_REQUIRED,
      403,
    );
  }

  if (trust.repoRoot !== projectRoot) {
    return errorResponse(
      c,
      "Trust was granted for a different repository root. Re-grant trust for this directory.",
      ErrorCode.TRUST_REQUIRED,
      403,
    );
  }

  await next();
  return undefined;
};
