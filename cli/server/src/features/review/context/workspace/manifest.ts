import { getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { readTextFileWithLimit } from "../../../../shared/lib/ai/bounded-file.js";
import { formatSchemaIssues } from "../../../../shared/lib/errors.js";
import { log } from "../../../../shared/lib/log.js";

// The reviewed repository controls every manifest read here, so the read is
// bounded rather than sized by the file itself.
const MAX_MANIFEST_BYTES = 256 * 1024;

const PackageManifestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

export type PackageManifest = z.infer<typeof PackageManifestSchema>;

export async function readPackageManifest(filePath: string): Promise<PackageManifest | null> {
  const read = await readTextFileWithLimit(filePath, MAX_MANIFEST_BYTES);
  if (!read.ok) {
    if (read.error.code === "oversize-response") {
      log("warn", "context_manifest_unreadable", { filePath, error: read.error.message });
    }
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(read.value);
  } catch (error) {
    log("warn", "context_manifest_unreadable", { filePath, error: getErrorMessage(error) });
    return null;
  }

  const result = PackageManifestSchema.safeParse(parsed);
  if (!result.success) {
    log("warn", "context_manifest_invalid", {
      filePath,
      issues: formatSchemaIssues(result.error),
    });
    return null;
  }

  return result.data;
}
