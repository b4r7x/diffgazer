import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { toPosixPath } from "../utils/fs.js";
import { readJson } from "../utils/json.js";

interface ParityOptions {
  sourceFilter?: (path: string) => boolean;
  artifactFilter?: (path: string) => boolean;
}

function collectFiles(dirPath: string, filter?: (path: string) => boolean): string[] {
  const files: string[] = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!filter || filter(entryPath)) stack.push(entryPath);
      } else if (entry.isFile()) {
        if (!filter || filter(entryPath)) files.push(entryPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function filesAreEquivalent(sourcePath: string, artifactPath: string): boolean {
  if (sourcePath.endsWith(".json") && artifactPath.endsWith(".json")) {
    try {
      return JSON.stringify(readJson(sourcePath)) === JSON.stringify(readJson(artifactPath));
    } catch {
      return false;
    }
  }

  const source = readFileSync(sourcePath);
  const artifact = readFileSync(artifactPath);
  return source.equals(artifact);
}

function compareFileTrees(
  sourceDir: string,
  artifactDir: string,
  label: string,
  errors: string[],
  options: ParityOptions = {},
): void {
  if (!existsSync(sourceDir)) {
    errors.push(`${label}: missing source directory ${sourceDir}`);
    return;
  }
  if (!existsSync(artifactDir)) {
    errors.push(`${label}: missing artifact directory ${artifactDir}`);
    return;
  }

  const sourceFiles = collectFiles(sourceDir, options.sourceFilter).map((file) =>
    toPosixPath(relative(sourceDir, file)),
  );
  const artifactFiles = collectFiles(artifactDir, options.artifactFilter).map((file) =>
    toPosixPath(relative(artifactDir, file)),
  );
  const expectedFiles = new Set(sourceFiles);
  const actualFiles = new Set(artifactFiles);
  const allFiles = new Set([...expectedFiles, ...actualFiles]);

  for (const relPath of [...allFiles].sort()) {
    const sourcePath = resolve(sourceDir, relPath);
    const artifactPath = resolve(artifactDir, relPath);
    if (!expectedFiles.has(relPath)) {
      errors.push(`${label}: stale artifact file ${relPath}`);
      continue;
    }
    if (!actualFiles.has(relPath)) {
      errors.push(`${label}: missing artifact file ${relPath}`);
      continue;
    }
    if (filesAreEquivalent(sourcePath, artifactPath)) continue;
    errors.push(`${label}: artifact differs from source for ${relPath}`);
  }
}

function compareCopiedPath(
  sourcePath: string,
  artifactPath: string,
  label: string,
  errors: string[],
  options: ParityOptions = {},
): void {
  if (!existsSync(sourcePath)) {
    errors.push(`${label}: missing source path ${sourcePath}`);
    return;
  }
  if (!existsSync(artifactPath)) {
    errors.push(`${label}: missing artifact path ${artifactPath}`);
    return;
  }

  const sourceStats = statSync(sourcePath);
  const artifactStats = statSync(artifactPath);

  if (sourceStats.isDirectory() && artifactStats.isDirectory()) {
    compareFileTrees(sourcePath, artifactPath, label, errors, options);
    return;
  }

  if (sourceStats.isFile() && artifactStats.isFile()) {
    if (!filesAreEquivalent(sourcePath, artifactPath)) {
      errors.push(`${label}: artifact differs from source`);
    }
    return;
  }

  errors.push(`${label}: source and artifact path types differ`);
}

export function collectPathParityErrors(
  sourcePath: string,
  artifactPath: string,
  label: string,
  options: ParityOptions = {},
): string[] {
  const errors: string[] = [];
  compareCopiedPath(sourcePath, artifactPath, label, errors, options);
  return errors;
}

export function collectTreeParityErrors(
  sourceDir: string,
  artifactDir: string,
  label: string,
  options: ParityOptions = {},
): string[] {
  const errors: string[] = [];
  compareFileTrees(sourceDir, artifactDir, label, errors, options);
  return errors;
}
