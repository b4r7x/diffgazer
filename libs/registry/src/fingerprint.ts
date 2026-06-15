import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "./logger.js";
import { collectAllFiles, relativePath } from "./utils/fs.js";

// Locale-independent code-unit comparison so the committed fingerprint hashes
// files in the same order on every machine (see libs/core catalog transform).
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function computeInputsFingerprint(rootDir: string, inputs: string[]): string {
  const hash = createHash("sha256");

  for (const inputRel of inputs) {
    const inputAbs = resolve(rootDir, inputRel);
    if (!existsSync(inputAbs)) {
      log.warn(`Fingerprint input not found, skipping: ${inputAbs}`);
      continue;
    }
    const stats = statSync(inputAbs);

    if (stats.isDirectory()) {
      const files = collectAllFiles(inputAbs).sort(compareCodeUnits);
      for (const filePath of files) {
        hash.update(relativePath(rootDir, filePath));
        hash.update("\n");
        hash.update(readFileSync(filePath));
        hash.update("\n");
      }
      continue;
    }

    hash.update(inputRel);
    hash.update("\n");
    hash.update(readFileSync(inputAbs));
    hash.update("\n");
  }

  return hash.digest("hex");
}

export function computeArtifactFingerprint(
  rootDir: string,
  inputs: string[],
  origin: string,
): string {
  const inputsFingerprint = computeInputsFingerprint(rootDir, inputs);
  const hash = createHash("sha256");
  hash.update(`origin:${origin}\n`);
  hash.update(inputsFingerprint);
  hash.update("\n");
  return hash.digest("hex");
}
