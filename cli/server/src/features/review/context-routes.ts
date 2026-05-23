import type { Context } from "hono";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { getErrorMessage } from "@diffgazer/core/errors";
import { errorResponse } from "../../shared/lib/http/response.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { getProjectDiffgazerDir } from "../../shared/lib/paths.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
import { buildProjectContextSnapshot, loadContextSnapshot } from "./context.js";

export async function getContextHandler(c: Context): Promise<Response> {
  const projectRoot = getProjectRoot(c);
  if (!isValidProjectPath(projectRoot)) {
    return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
  }

  const contextDir = getProjectDiffgazerDir(projectRoot);
  const snapshot = await loadContextSnapshot(contextDir);

  if (!snapshot) {
    return errorResponse(c, "Context snapshot not found", ErrorCode.NOT_FOUND, 404);
  }

  return c.json({
    text: snapshot.markdown,
    markdown: snapshot.markdown,
    graph: snapshot.graph,
    meta: snapshot.meta,
  });
}

export async function refreshContextHandler(
  c: Context,
  body: { force?: boolean },
): Promise<Response> {
  const projectRoot = getProjectRoot(c);
  if (!isValidProjectPath(projectRoot)) {
    return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
  }

  try {
    const snapshot = await buildProjectContextSnapshot(projectRoot, {
      force: body.force,
    });
    return c.json({
      text: snapshot.markdown,
      markdown: snapshot.markdown,
      graph: snapshot.graph,
      meta: snapshot.meta,
    });
  } catch (error) {
    console.error("[context] Failed to refresh project context:", getErrorMessage(error));
    return errorResponse(c, "Failed to refresh project context", ErrorCode.INTERNAL_ERROR, 500);
  }
}
