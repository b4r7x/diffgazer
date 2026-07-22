import { type TrustConfig, TrustConfigSchema } from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { writeJsonFile, writeJsonFileSync } from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalTrustPath } from "../../paths.js";
import { withFileTransactionLock } from "../transaction/file-lock.js";
import type { TrustState } from "../types.js";
import { loadOrQuarantine, RESERVED_PROJECT_IDS } from "./load-json.js";

const PersistedTrustStateSchema = z.object({
  projects: z.record(z.string(), z.unknown()).optional(),
});

let _trustPath: string | undefined;

const TRUST_PATH = (): string => {
  _trustPath ??= getGlobalTrustPath();
  return _trustPath;
};

const validateTrustRecord = (projectId: string, raw: unknown): TrustConfig | null => {
  const result = TrustConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  log("warn", "config_trust_record_invalid", { projectId, error: result.error.message });
  return null;
};

export const loadTrust = (): TrustState => {
  const stored = loadOrQuarantine(TRUST_PATH(), "trust", PersistedTrustStateSchema);
  if (!stored?.projects) {
    return { projects: {} };
  }

  const validated: Record<string, TrustConfig> = {};
  for (const [projectId, config] of Object.entries(stored.projects)) {
    if (RESERVED_PROJECT_IDS.has(projectId)) {
      log("warn", "config_trust_record_reserved_id", { projectId });
      continue;
    }
    const record = validateTrustRecord(projectId, config);
    if (record) validated[projectId] = record;
  }

  return { projects: validated };
};

export const persistTrust = (state: TrustState): void => {
  writeJsonFileSync(TRUST_PATH(), state, 0o600);
};

export const persistTrustRecordAsync = (config: TrustConfig): Promise<void> => {
  return withFileTransactionLock(TRUST_PATH(), async () => {
    const disk = loadTrust();
    disk.projects[config.projectId] = config;
    await writeJsonFile(TRUST_PATH(), disk, 0o600);
  });
};

export const persistTrustRemovalAsync = (projectId: string): Promise<void> => {
  return withFileTransactionLock(TRUST_PATH(), async () => {
    const disk = loadTrust();
    delete disk.projects[projectId];
    await writeJsonFile(TRUST_PATH(), disk, 0o600);
  });
};
