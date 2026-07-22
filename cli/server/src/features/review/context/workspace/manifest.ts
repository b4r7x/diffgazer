import { readFile } from "node:fs/promises";
import { getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { log } from "../../../../shared/lib/log.js";

const PackageManifestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

export type PackageManifest = z.infer<typeof PackageManifestSchema>;

export function formatSchemaIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export async function readPackageManifest(filePath: string): Promise<PackageManifest | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
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
