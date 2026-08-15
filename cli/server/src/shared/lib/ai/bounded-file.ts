import { open, stat } from "node:fs/promises";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";

export type BoundedFileReadFailure = Readonly<{
  code: "oversize-response" | "read-failed";
  message: string;
}>;

/**
 * Reads a UTF-8 text file with a hard byte ceiling. Pre-stat rejects files over
 * the cap; the read still stops at maxBytes+1 so a racing writer cannot bypass
 * the limit.
 */
export async function readTextFileWithLimit(
  filePath: string,
  maxBytes: number,
): Promise<Result<string, BoundedFileReadFailure>> {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.size > maxBytes) {
      return err({
        code: "oversize-response",
        message: `File exceeds the ${maxBytes}-byte limit`,
      });
    }

    const handle = await open(filePath, "r");
    try {
      const readLength = Math.min(maxBytes + 1, Math.max(fileStat.size, 1));
      const buffer = Buffer.allocUnsafe(readLength);
      const { bytesRead } = await handle.read(buffer, 0, readLength, 0);
      if (bytesRead > maxBytes) {
        return err({
          code: "oversize-response",
          message: `File exceeds the ${maxBytes}-byte limit`,
        });
      }
      return ok(buffer.subarray(0, bytesRead).toString("utf8"));
    } finally {
      await handle.close();
    }
  } catch (error) {
    return err({
      code: "read-failed",
      message: getErrorMessage(error, "Failed to read file"),
    });
  }
}
