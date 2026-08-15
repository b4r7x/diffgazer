import { type TrustConfig, TrustConfigSchema } from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { writeJsonFile } from "../../fs.js";
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

interface StoredTrustRecord {
  readonly raw: unknown;
  /** Null when this binary cannot read the record: ignored at read time, kept on disk. */
  readonly config: TrustConfig | null;
}

const validateTrustRecord = (projectId: string, raw: unknown): TrustConfig | null => {
  const result = TrustConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  log("warn", "config_trust_record_invalid", { projectId, error: result.error.message });
  return null;
};

const loadStoredRecords = (): Record<string, StoredTrustRecord> => {
  const stored = loadOrQuarantine(TRUST_PATH(), "trust", PersistedTrustStateSchema);
  const records: Record<string, StoredTrustRecord> = {};
  for (const [projectId, raw] of Object.entries(stored?.projects ?? {})) {
    if (RESERVED_PROJECT_IDS.has(projectId)) {
      log("warn", "config_trust_record_reserved_id", { projectId });
      continue;
    }
    records[projectId] = { raw, config: validateTrustRecord(projectId, raw) };
  }
  return records;
};

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// TrustConfigSchema strips unknown keys, so a write rebuilt from validated state
// alone would delete fields a newer binary added. Layer the validated record over
// the object still on disk instead, matching the settings round trip.
const withStoredFields = (stored: unknown, config: TrustConfig): TrustConfig => {
  if (!isRecordObject(stored)) return config;
  const capabilities = isRecordObject(stored.capabilities)
    ? { ...stored.capabilities, ...config.capabilities }
    : config.capabilities;
  return { ...stored, ...config, capabilities };
};

// Every stored record is carried through, including one this binary could not
// parse: an unrecognized record is ignored at read time but must never be
// destroyed by an unrelated project's trust save.
const storedProjectsForWrite = (): Record<string, unknown> => {
  const projects: Record<string, unknown> = {};
  for (const [projectId, record] of Object.entries(loadStoredRecords())) {
    projects[projectId] = record.raw;
  }
  return projects;
};

export const loadTrust = (): TrustState => {
  const projects: Record<string, TrustConfig> = {};
  for (const [projectId, record] of Object.entries(loadStoredRecords())) {
    if (record.config) projects[projectId] = record.config;
  }
  return { projects };
};

export const persistTrustRecordAsync = (config: TrustConfig): Promise<void> => {
  return withFileTransactionLock(TRUST_PATH(), async () => {
    const projects = storedProjectsForWrite();
    projects[config.projectId] = withStoredFields(projects[config.projectId], config);
    await writeJsonFile(TRUST_PATH(), { projects }, 0o600);
  });
};

export const persistTrustRemovalAsync = (projectId: string): Promise<void> => {
  return withFileTransactionLock(TRUST_PATH(), async () => {
    const projects = storedProjectsForWrite();
    delete projects[projectId];
    await writeJsonFile(TRUST_PATH(), { projects }, 0o600);
  });
};
