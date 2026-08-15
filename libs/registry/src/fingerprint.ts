import { createHash, type Hash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { REGISTRY_ORIGIN } from "./constants.js";
import { normalizeOrigin } from "./origin.js";
import { compareCodeUnits } from "./utils/compare-code-units.js";
import { collectAllFiles, resolveInside, toPosixPath } from "./utils/fs.js";

export interface InputsFingerprintResult {
  fingerprint: string;
  missing: string[];
}

interface InputsFingerprintOptions {
  missingInputMode: "warn" | "collect";
  requireNonEmptyDirectories?: boolean;
}

// Length-framed records. With a bare separator, a file whose bytes spell
// "<sep><path><sep><content>" impersonates a record boundary, so two different
// input trees can hash to the same digest.
function updateFileRecord(hash: Hash, relativePath: string, content: Buffer): void {
  const path = Buffer.from(relativePath, "utf-8");
  hash.update(`${path.byteLength}:`);
  hash.update(path);
  hash.update(`${content.byteLength}:`);
  hash.update(content);
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
  console.warn(`Fingerprint input not found, skipping: ${input}`);
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
        updateFileRecord(hash, toPosixPath(relative(rootAbs, filePath)), readFileSync(filePath));
      }
      continue;
    }

    updateFileRecord(hash, toPosixPath(relative(rootAbs, inputAbs)), readFileSync(inputAbs));
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
