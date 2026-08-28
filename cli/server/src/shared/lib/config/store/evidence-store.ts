import { dirname, join } from "node:path";
import { readJsonFileSyncSafe, removeFileSync, writeJsonFile } from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath } from "../../paths.js";
import { type AdmissionEvidence, AdmissionEvidenceSchema } from "../admission-evidence.js";
import type { ConfigDocumentV2 } from "../types.js";

export const evidenceReferenceFor = (configurationId: string): string =>
  `evidence-${configurationId}`;

const evidencePath = (evidenceReference: string): string =>
  join(dirname(getGlobalConfigPath()), "evidence", `${evidenceReference}.json`);

export interface EvidenceStore {
  get(configurationId: string): AdmissionEvidence | null;
  set(configurationId: string, evidence: AdmissionEvidence): void;
  clear(configurationId: string): void;
  reload(configurations: ConfigDocumentV2["configurations"]): void;
  snapshot(): ReadonlyMap<string, AdmissionEvidence>;
  write(evidenceReference: string, evidence: AdmissionEvidence): Promise<void>;
}

/** The admission proofs kept beside the config document, one file per configuration. */
export function createEvidenceStore(): EvidenceStore {
  const evidenceByConfiguration = new Map<string, AdmissionEvidence>();

  const removeEvidenceFile = (configurationId: string): void => {
    try {
      removeFileSync(evidencePath(evidenceReferenceFor(configurationId)));
    } catch {
      log("warn", "config_evidence_delete_failed", {
        code: "PERSIST_FAILED",
        operation: "delete-evidence",
      });
    }
  };

  return {
    get: (configurationId) => evidenceByConfiguration.get(configurationId) ?? null,
    set: (configurationId, evidence) => {
      evidenceByConfiguration.set(configurationId, evidence);
    },
    clear: (configurationId) => {
      evidenceByConfiguration.delete(configurationId);
      removeEvidenceFile(configurationId);
    },
    reload: (configurations) => {
      evidenceByConfiguration.clear();
      for (const entry of configurations) {
        if (entry.status !== "supported") continue;
        const record = entry.record;
        if (record.evidenceReference !== evidenceReferenceFor(record.configurationId)) continue;
        const read = readJsonFileSyncSafe<unknown>(evidencePath(record.evidenceReference));
        const parsed = read.status === "ok" ? AdmissionEvidenceSchema.safeParse(read.data) : null;
        if (parsed?.success) {
          evidenceByConfiguration.set(record.configurationId, parsed.data);
          continue;
        }
        // A dropped proof silently downgrades the configuration to unproven, so
        // say so: the next test re-proves it, but the drop must be observable.
        // A referenced file that is missing or corrupt is the same drop as a
        // parse failure — the reference proves evidence was persisted once.
        log("warn", "config_evidence_load_failed", {
          code: "CONFIGURATION_UNSUPPORTED",
          operation: "load-evidence",
          configurationId: record.configurationId,
          reason: read.status === "ok" ? "invalid-evidence" : read.status,
        });
      }
    },
    snapshot: () => new Map(evidenceByConfiguration),
    write: (evidenceReference, evidence) =>
      writeJsonFile(evidencePath(evidenceReference), evidence, 0o600),
  };
}
