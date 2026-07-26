import type { z } from "zod";
import { formatSchemaIssues } from "../../errors.js";
import { quarantineCorruptFile, readJsonFileSyncSafe } from "../../fs.js";
import { log } from "../../log.js";

export const RESERVED_PROJECT_IDS = new Set(["__proto__", "constructor", "prototype"]);

export const loadOrQuarantine = <T>(
  filePath: string,
  label: string,
  schema: z.ZodType<T>,
): T | null => {
  const result = readJsonFileSyncSafe<unknown>(filePath);
  if (result.status === "ok") {
    const parsed = schema.safeParse(result.data);
    if (parsed.success) return parsed.data;
    const backupPath = quarantineCorruptFile(filePath);
    log("warn", "config_invalid_quarantined", {
      label,
      filePath,
      backupPath,
      issues: formatSchemaIssues(parsed.error),
    });
    return null;
  }
  if (result.status === "missing") return null;
  const backupPath = quarantineCorruptFile(filePath);
  log("warn", "config_corrupt_quarantined", { label, filePath, backupPath });
  return null;
};
