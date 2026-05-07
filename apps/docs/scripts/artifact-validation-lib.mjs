import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const HASH_RE = /^[a-f0-9]{64}$/;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function toPosixPath(path) {
  return path.split(/[\\/]+/).join("/");
}

function artifactCopyFilter(path) {
  return !/\.(md)$/i.test(path)
    && !/\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(path)
    && !path.includes("__tests__");
}

function collectFiles(dirPath, options = {}) {
  const { filter } = options;
  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!filter || filter(entryPath)) {
          stack.push(entryPath);
        }
      } else if (entry.isFile()) {
        if (!filter || filter(entryPath)) {
          files.push(entryPath);
        }
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export function computeStrictInputsFingerprint(rootDir, inputs) {
  const rootAbs = resolve(rootDir);
  const hash = createHash("sha256");
  const missing = [];

  for (const inputRel of inputs) {
    const inputAbs = resolve(rootAbs, inputRel);
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
    {
      errors.push(`${label}: artifact differs from source for ${relPath}`);
    }
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

export function validateArtifactMirror(sourceDir, mirrorDir, label) {
  const errors = [];
  compareFileTrees(sourceDir, mirrorDir, label, errors);
  return errors;
}

function validateGeneratedEntries(rootDir, artifactRoot, generated, label, errors) {
  if (!generated) return;

  for (const [name, relPath] of Object.entries(generated)) {
    const sourcePath = resolve(rootDir, "docs", relPath);
    const artifactPath = resolve(artifactRoot, relPath);
    compareCopiedPath(sourcePath, artifactPath, `${label} generated ${name}`, errors, {
      sourceFilter: artifactCopyFilter,
    });
  }
}

function validateManifestDeclaredCopiedDirs(rootDir, artifactRootAbs, manifest, label, errors) {
  compareFileTrees(
    resolve(rootDir, "docs/content"),
    resolve(artifactRootAbs, manifest.docs.contentDir),
    `${label} docs content`,
    errors,
    { sourceFilter: artifactCopyFilter },
  );

  if (manifest.docs.assetsDir) {
    compareFileTrees(
      resolve(rootDir, "docs/assets"),
      resolve(artifactRootAbs, manifest.docs.assetsDir),
      `${label} docs assets`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }

  if (manifest.docs.generatedDir) {
    compareFileTrees(
      resolve(rootDir, "docs/generated"),
      resolve(artifactRootAbs, manifest.docs.generatedDir),
      `${label} docs generated`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }

  compareFileTrees(
    resolve(rootDir, "public/r"),
    resolve(artifactRootAbs, manifest.registry.publicDir),
    `${label} public/r`,
    errors,
    { sourceFilter: artifactCopyFilter },
  );

  if (manifest.source?.registryDir) {
    compareFileTrees(
      resolve(rootDir, "registry"),
      resolve(artifactRootAbs, manifest.source.registryDir),
      `${label} source registry`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }

  if (manifest.source?.stylesDir) {
    compareFileTrees(
      resolve(rootDir, "styles"),
      resolve(artifactRootAbs, manifest.source.stylesDir),
      `${label} source styles`,
      errors,
      { sourceFilter: artifactCopyFilter },
    );
  }
}

export function validateLibraryArtifacts(options) {
  const { rootDir, label = rootDir, artifactRoot = "dist/artifacts" } = options;
  const errors = [];
  const artifactRootAbs = resolve(rootDir, artifactRoot);
  const manifestPath = resolve(artifactRootAbs, "artifact-manifest.json");
  const fingerprintPath = resolve(artifactRootAbs, "fingerprint.sha256");

  if (!existsSync(manifestPath)) {
    return [`${label}: missing artifact manifest at ${manifestPath}`];
  }
  if (!existsSync(fingerprintPath)) {
    return [`${label}: missing artifact fingerprint at ${fingerprintPath}`];
  }

  const manifest = readJson(manifestPath);
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) {
    errors.push(`${label}: artifact manifest has no inputs`);
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

  validateManifestDeclaredCopiedDirs(rootDir, artifactRootAbs, manifest, label, errors);
  validateGeneratedEntries(rootDir, artifactRootAbs, manifest.generated, label, errors);

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
