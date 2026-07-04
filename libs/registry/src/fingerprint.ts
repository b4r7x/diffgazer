import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { REGISTRY_ORIGIN } from "./constants.js";
import { log } from "./logger.js";
import { normalizeOrigin } from "./origin.js";
import { collectAllFiles, resolveInside, toPosixPath } from "./utils/fs.js";

// Locale-independent code-unit comparison so the committed fingerprint hashes
// files in the same order on every machine (see libs/core catalog transform).
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface InputsFingerprintResult {
  fingerprint: string;
  missing: string[];
}

interface InputsFingerprintOptions {
  missingInputMode: "warn" | "collect";
  requireNonEmptyDirectories?: boolean;
}

function recordMissingInput(
  missing: string[],
  input: string,
  options: InputsFingerprintOptions,
): void {
  if (options.missingInputMode === "collect") {
    missing.push(input);
    return;
  }
  log.warn(`Fingerprint input not found, skipping: ${input}`);
}

function computeInputsFingerprintResult(
  rootDir: string,
  inputs: string[],
  options: InputsFingerprintOptions,
): InputsFingerprintResult {
  const rootAbs = resolve(rootDir);
  const hash = createHash("sha256");
  const missing: string[] = [];

  for (const inputRel of inputs) {
    let inputAbs: string;
    try {
      inputAbs = resolveInside(rootAbs, inputRel, `fingerprint input ${inputRel}`);
    } catch (error) {
      recordMissingInput(missing, error instanceof Error ? error.message : String(error), options);
      continue;
    }

    if (!existsSync(inputAbs)) {
      recordMissingInput(missing, inputRel, options);
      continue;
    }
    const stats = statSync(inputAbs);

    if (stats.isDirectory()) {
      const files = collectAllFiles(inputAbs).sort(compareCodeUnits);
      if (files.length === 0 && options.requireNonEmptyDirectories) {
        recordMissingInput(missing, `${inputRel}/*`, options);
        continue;
      }

      for (const filePath of files) {
        hash.update(toPosixPath(relative(rootAbs, filePath)));
        hash.update("\n");
        hash.update(readFileSync(filePath));
        hash.update("\n");
      }
      continue;
    }

    hash.update(toPosixPath(relative(rootAbs, inputAbs)));
    hash.update("\n");
    hash.update(readFileSync(inputAbs));
    hash.update("\n");
  }

  return { fingerprint: hash.digest("hex"), missing };
}

export function computeInputsFingerprint(rootDir: string, inputs: string[]): string {
  return computeInputsFingerprintResult(rootDir, inputs, {
    missingInputMode: "warn",
  }).fingerprint;
}

function computeStrictInputsFingerprint(
  rootDir: string,
  inputs: string[],
): InputsFingerprintResult {
  return computeInputsFingerprintResult(rootDir, inputs, {
    missingInputMode: "collect",
    requireNonEmptyDirectories: true,
  });
}

function computeArtifactFingerprintDigest(inputsFingerprint: string, origin: string): string {
  const hash = createHash("sha256");
  hash.update(`origin:${origin}\n`);
  hash.update(inputsFingerprint);
  hash.update("\n");
  return hash.digest("hex");
}

export function computeArtifactFingerprint(
  rootDir: string,
  inputs: string[],
  origin: string,
): string {
  const inputsFingerprint = computeInputsFingerprint(rootDir, inputs);
  return computeArtifactFingerprintDigest(inputsFingerprint, origin);
}

export function computeStrictArtifactFingerprint(
  rootDir: string,
  inputs: string[],
  originRaw?: string | null,
): InputsFingerprintResult {
  const inputsResult = computeStrictInputsFingerprint(rootDir, inputs);
  const origin = normalizeOrigin(originRaw, { defaultOrigin: REGISTRY_ORIGIN });
  return {
    fingerprint: computeArtifactFingerprintDigest(inputsResult.fingerprint, origin),
    missing: inputsResult.missing,
  };
}

export function computeRequiredArtifactFingerprint(
  rootDir: string,
  inputs: string[],
  originRaw: string | undefined | null,
  label = "artifact",
): string {
  const result = computeStrictArtifactFingerprint(rootDir, inputs, originRaw);
  if (result.missing.length > 0) {
    throw new Error(
      [
        `${label} fingerprint inputs are missing:`,
        ...result.missing.map((input) => `- ${input}`),
      ].join("\n"),
    );
  }
  return result.fingerprint;
}
