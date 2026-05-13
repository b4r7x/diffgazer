import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { collectFiles } from "./files.mjs";
import { readJson } from "./json.mjs";
import { isRelativeSubpath, resolveInside, toPosixPath } from "./paths.mjs";

const HASH_RE = /^[a-f0-9]{64}$/;
const NAMESPACE_RE = /^@[a-z0-9][\w-]*(?:\/[a-z0-9][\w-]*)?$/i;

function artifactCopyFilter(path) {
  return !/\.(md)$/i.test(path)
    && !/\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(path)
    && !path.includes("__tests__");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateString(value, path, errors) {
  if (typeof value === "string" && value.length > 0) return;
  errors.push(`${path}: Expected non-empty string`);
}

function validateRelativePath(value, path, errors) {
  if (isRelativeSubpath(value)) return;
  errors.push(`${path}: Path must be relative and must not contain '..' segments`);
}

function validateOptionalRelativePath(value, path, errors) {
  if (value === undefined) return;
  validateRelativePath(value, path, errors);
}

function validateObject(value, path, errors) {
  if (isPlainObject(value)) return true;
  errors.push(`${path}: Expected object`);
  return false;
}

function validateRelativePathRecord(value, path, errors) {
  if (value === undefined) return;
  if (!validateObject(value, path, errors)) return;

  for (const [key, relPath] of Object.entries(value)) {
    validateString(key, `${path} key`, errors);
    validateRelativePath(relPath, `${path}.${key}`, errors);
  }
}

function validateArtifactManifest(manifest) {
  const errors = [];

  if (!validateObject(manifest, "manifest", errors)) return errors;

  if (manifest.schemaVersion !== 1) {
    errors.push("schemaVersion: Expected 1");
  }
  validateString(manifest.library, "library", errors);
  validateString(manifest.package, "package", errors);
  validateString(manifest.version, "version", errors);
  validateRelativePath(manifest.artifactRoot, "artifactRoot", errors);

  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) {
    errors.push("inputs: Expected non-empty array");
  } else {
    manifest.inputs.forEach((input, index) =>
      validateRelativePath(input, `inputs.${index}`, errors),
    );
  }

  if (validateObject(manifest.docs, "docs", errors)) {
    validateRelativePath(manifest.docs.contentDir, "docs.contentDir", errors);
    validateRelativePath(manifest.docs.metaFile, "docs.metaFile", errors);
    validateOptionalRelativePath(manifest.docs.generatedDir, "docs.generatedDir", errors);
    validateOptionalRelativePath(manifest.docs.assetsDir, "docs.assetsDir", errors);
  }

  if (validateObject(manifest.registry, "registry", errors)) {
    if (typeof manifest.registry.namespace !== "string" || !NAMESPACE_RE.test(manifest.registry.namespace)) {
      errors.push("registry.namespace: Invalid registry namespace");
    }
    validateString(manifest.registry.basePath, "registry.basePath", errors);
    validateRelativePath(manifest.registry.publicDir, "registry.publicDir", errors);
    validateRelativePath(manifest.registry.index, "registry.index", errors);
  }

  if (manifest.source !== undefined && validateObject(manifest.source, "source", errors)) {
    validateOptionalRelativePath(manifest.source.registryDir, "source.registryDir", errors);
    validateOptionalRelativePath(manifest.source.stylesDir, "source.stylesDir", errors);
  }

  validateRelativePathRecord(manifest.generated, "generated", errors);

  if (validateObject(manifest.integrity, "integrity", errors)) {
    if (manifest.integrity.algorithm !== "sha256") {
      errors.push("integrity.algorithm: Expected sha256");
    }
    validateRelativePath(manifest.integrity.fingerprintFile, "integrity.fingerprintFile", errors);
  }

  return errors;
}

export function computeStrictInputsFingerprint(rootDir, inputs) {
  const rootAbs = resolve(rootDir);
  const hash = createHash("sha256");
  const missing = [];

  for (const inputRel of inputs) {
    let inputAbs;
    try {
      inputAbs = resolveInside(rootAbs, inputRel, `fingerprint input ${inputRel}`);
    } catch (error) {
      missing.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (!existsSync(inputAbs)) {
      missing.push(inputRel);
      continue;
    }

    const stats = statSync(inputAbs);
    if (stats.isDirectory()) {
      const files = collectFiles(inputAbs);
      if (files.length === 0) {
        missing.push(`${inputRel}/*`);
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

    hash.update(inputRel);
    hash.update("\n");
    hash.update(readFileSync(inputAbs));
    hash.update("\n");
  }

  return { fingerprint: hash.digest("hex"), missing };
}

function compareFileTrees(sourceDir, artifactDir, label, errors, options = {}) {
  if (!existsSync(sourceDir)) {
    errors.push(`${label}: missing source directory ${sourceDir}`);
    return;
  }
  if (!existsSync(artifactDir)) {
    errors.push(`${label}: missing artifact directory ${artifactDir}`);
    return;
  }

  const sourceFiles = collectFiles(sourceDir, { filter: options.sourceFilter })
    .map((file) => toPosixPath(relative(sourceDir, file)));
  const artifactFiles = collectFiles(artifactDir, { filter: options.artifactFilter })
    .map((file) => toPosixPath(relative(artifactDir, file)));
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
    if (filesAreEquivalent(sourcePath, artifactPath)) {
      continue;
    }
    errors.push(`${label}: artifact differs from source for ${relPath}`);
  }
}

function compareCopiedPath(sourcePath, artifactPath, label, errors, options = {}) {
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

export function collectPathParityErrors(sourcePath, artifactPath, label, options = {}) {
  const errors = [];
  compareCopiedPath(sourcePath, artifactPath, label, errors, options);
  return errors;
}

export function collectTreeParityErrors(sourceDir, artifactDir, label, options = {}) {
  const errors = [];
  compareFileTrees(sourceDir, artifactDir, label, errors, options);
  return errors;
}

function filesAreEquivalent(sourcePath, artifactPath) {
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

function validateGeneratedEntries(rootDir, artifactRoot, generated, label, errors) {
  if (!generated) return;

  for (const [name, relPath] of Object.entries(generated)) {
    const sourcePath = resolveInside(resolve(rootDir, "docs"), relPath, `${label} generated ${name} source path`);
    const artifactPath = resolveInside(artifactRoot, relPath, `${label} generated ${name} artifact path`);
    compareCopiedPath(sourcePath, artifactPath, `${label} generated ${name}`, errors, {
      sourceFilter: artifactCopyFilter,
    });
  }
}

function validateManifestDeclaredCopiedDirs(rootDir, artifactRootAbs, manifest, label, errors) {
  compareFileTrees(
    resolve(rootDir, "docs/content"),
    resolveInside(artifactRootAbs, manifest.docs.contentDir, `${label} docs content artifact path`),
    `${label} docs content`,
    errors,
    { sourceFilter: artifactCopyFilter },
  );

  if (manifest.docs.assetsDir) {
    compareFileTrees(
      resolve(rootDir, "docs/assets"),
      resolveInside(artifactRootAbs, manifest.docs.assetsDir, `${label} docs assets artifact path`),
      `${label} docs assets`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }

  if (manifest.docs.generatedDir) {
    compareFileTrees(
      resolve(rootDir, "docs/generated"),
      resolveInside(artifactRootAbs, manifest.docs.generatedDir, `${label} docs generated artifact path`),
      `${label} docs generated`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }

  compareFileTrees(
    resolve(rootDir, "public/r"),
    resolveInside(artifactRootAbs, manifest.registry.publicDir, `${label} public registry artifact path`),
    `${label} public/r`,
    errors,
    { sourceFilter: artifactCopyFilter },
  );

  if (manifest.source?.registryDir) {
    compareFileTrees(
      resolve(rootDir, "registry"),
      resolveInside(artifactRootAbs, manifest.source.registryDir, `${label} source registry artifact path`),
      `${label} source registry`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }

  if (manifest.source?.stylesDir) {
    compareFileTrees(
      resolve(rootDir, "styles"),
      resolveInside(artifactRootAbs, manifest.source.stylesDir, `${label} source styles artifact path`),
      `${label} source styles`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }
}

export function validateLibraryArtifacts(options) {
  const { rootDir, label = rootDir, artifactRoot = "dist/artifacts" } = options;
  const errors = [];
  let manifestRootAbs;
  try {
    manifestRootAbs = resolveInside(rootDir, artifactRoot, `${label} artifact root`);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const manifestPath = resolveInside(manifestRootAbs, "artifact-manifest.json", `${label} artifact manifest path`);

  if (!existsSync(manifestPath)) {
    return [`${label}: missing artifact manifest at ${manifestPath}`];
  }

  const manifest = readJson(manifestPath);
  const manifestErrors = validateArtifactManifest(manifest);
  if (manifestErrors.length > 0) {
    return [
      `${label} manifest validation failed:`,
      ...manifestErrors.map((error) => `${label}: ${error}`),
    ];
  }

  let artifactRootAbs;
  try {
    artifactRootAbs = resolveInside(rootDir, manifest.artifactRoot, `${label} manifest artifact root`);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  if (artifactRootAbs !== manifestRootAbs) {
    errors.push(
      `${label}: artifact manifest root ${manifest.artifactRoot} does not match validated artifact root ${toPosixPath(relative(rootDir, manifestRootAbs))}`,
    );
  }

  const fingerprintPath = resolveInside(
    artifactRootAbs,
    manifest.integrity.fingerprintFile,
    `${label} artifact fingerprint path`,
  );

  if (!existsSync(fingerprintPath)) {
    errors.push(`${label}: missing artifact fingerprint at ${fingerprintPath}`);
    return errors;
  }

  const recorded = readFileSync(fingerprintPath, "utf-8").trim();
  if (!HASH_RE.test(recorded)) {
    errors.push(`${label}: artifact fingerprint is not a sha256 hex digest`);
  }

  const { fingerprint, missing } = computeStrictInputsFingerprint(rootDir, manifest.inputs ?? []);
  for (const input of missing) {
    errors.push(`${label}: missing fingerprint input ${input}`);
  }
  if (recorded && fingerprint !== recorded) {
    errors.push(`${label}: artifact fingerprint mismatch; expected ${fingerprint}, found ${recorded}`);
  }

  try {
    validateManifestDeclaredCopiedDirs(rootDir, artifactRootAbs, manifest, label, errors);
    validateGeneratedEntries(rootDir, artifactRootAbs, manifest.generated, label, errors);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return errors;
}

export function computeBundleIntegrity(bundle, keys) {
  const content = JSON.stringify(Object.fromEntries(keys.map((key) => [key, bundle[key]])));
  return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

export function validateIntegrityBundle(filePath, keys, label) {
  if (!existsSync(filePath)) {
    return [`${label}: missing bundle ${filePath}`];
  }

  const bundle = readJson(filePath);
  const errors = [];
  for (const key of keys) {
    if (!(key in bundle)) {
      errors.push(`${label}: bundle ${key} is missing`);
    }
  }
  if (!Array.isArray(bundle.items)) {
    errors.push(`${label}: bundle items must be an array`);
  }
  if (typeof bundle.integrity !== "string") {
    errors.push(`${label}: bundle integrity is missing`);
  }

  if (errors.length === 0) {
    const expected = computeBundleIntegrity(bundle, keys);
    if (bundle.integrity !== expected) {
      errors.push(`${label}: bundle integrity mismatch; expected ${expected}, found ${bundle.integrity}`);
    }
  }

  return errors;
}

export function assertNoDuplicateDemoKeys(items, label) {
  const seen = new Set();
  const duplicates = new Set();

  for (const item of items) {
    const examples = item?.meta?.examples;
    if (!examples || typeof examples !== "object") continue;
    for (const key of Object.keys(examples)) {
      const scopedKey = `${item.name}:${key}`;
      if (seen.has(scopedKey)) duplicates.add(scopedKey);
      seen.add(scopedKey);
    }
  }

  return [...duplicates].map((key) => `${label}: duplicate demo key ${key}`);
}
