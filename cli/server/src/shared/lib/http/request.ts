import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { canonicalizeProjectRoot, isPackaged, resolveProjectRoot } from "../paths.js";

function decodeProjectRootHeader(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid project root header encoding");
  }
}

export const getProjectRoot = (c: Context): string => {
  try {
    const encodedHeader =
      !isPackaged() && process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT === "1"
        ? c.req.header(PROJECT_ROOT_HEADER)
        : undefined;
    return canonicalizeProjectRoot(
      resolveProjectRoot({
        header: encodedHeader === undefined ? undefined : decodeProjectRootHeader(encodedHeader),
        env: process.env.DIFFGAZER_PROJECT_ROOT,
        cwd: process.cwd(),
      }),
    );
  } catch (cause) {
    throw new HTTPException(400, {
      message: getErrorMessage(cause, "Invalid project root"),
      cause,
    });
  }
};
