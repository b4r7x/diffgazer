import { statSync } from "node:fs";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import { getSecretsRecoveryPath } from "../persistence/secrets-recovery.js";

const ABSENT_FILE = "absent";
const UNVOUCHED_FILE = "unvouched";

export type DocumentFingerprints = Readonly<{
  config: string;
  secrets: string;
  recovery: string;
}>;

const fingerprintFile = (filePath: string): string => {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? ABSENT_FILE : UNVOUCHED_FILE;
  }
  // Every replacement renames a fresh temp file in, so a changed inode is what
  // makes a replacement detectable at all. Filesystems that report no inode
  // (FAT/exFAT) leave only size and two coarse timestamps, which cannot rule out
  // a replacement inside one timestamp tick — so they never vouch for identity.
  if (stat.ino === 0) return UNVOUCHED_FILE;
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
};

export const captureDocumentFingerprints = (): DocumentFingerprints => ({
  config: fingerprintFile(getGlobalConfigPath()),
  secrets: fingerprintFile(getGlobalSecretsPath()),
  // The journal is the third document: it appears when a writer is mid-commit or
  // died mid-commit, and only the locked path may reconcile it.
  recovery: fingerprintFile(getSecretsRecoveryPath()),
});

export const sameDocumentFingerprints = (
  left: DocumentFingerprints,
  right: DocumentFingerprints,
): boolean =>
  left.config === right.config &&
  left.secrets === right.secrets &&
  left.recovery === right.recovery &&
  left.config !== UNVOUCHED_FILE &&
  left.secrets !== UNVOUCHED_FILE &&
  left.recovery !== UNVOUCHED_FILE;
