import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  collectPathParityErrors,
  collectTreeParityErrors,
  computeStrictArtifactFingerprint,
  normalizeOrigin,
  REGISTRY_ORIGIN,
  RELATIVE_JS_IMPORT_RE,
  validateManifest,
} from "@diffgazer/registry";
import { readJson } from "./json.mjs";
import { resolveInside, toPosixPath } from "./paths.mjs";

const HASH_RE = /^[a-f0-9]{64}$/;

function artifactCopyFilter(path) {
  return (
    !/\.(md)$/i.test(path) &&
    !/\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(path) &&
    !path.includes("__tests__")
  );
}

function validateGeneratedEntries(rootDir, artifactRoot, generated, label, errors) {
  if (!generated) return;

  for (const [name, relPath] of Object.entries(generated)) {
    const sourcePath = resolveInside(
      resolve(rootDir, "docs"),
      relPath,
      `${label} generated ${name} source path`,
    );
    const artifactPath = resolveInside(
      artifactRoot,
      relPath,
      `${label} generated ${name} artifact path`,
    );
    errors.push(
      ...collectPathParityErrors(sourcePath, artifactPath, `${label} generated ${name}`, {
        sourceFilter: artifactCopyFilter,
      }),
    );
  }
}

function validateManifestDeclaredCopiedDirs(rootDir, artifactRootAbs, manifest, label, errors) {
  errors.push(
    ...collectTreeParityErrors(
      resolve(rootDir, "docs/content"),
      resolveInside(
        artifactRootAbs,
        manifest.docs.contentDir,
        `${label} docs content artifact path`,
      ),
      `${label} docs content`,
      { sourceFilter: artifactCopyFilter },
    ),
  );

  if (manifest.docs.assetsDir) {
    errors.push(
      ...collectTreeParityErrors(
        resolve(rootDir, "docs/assets"),
        resolveInside(
          artifactRootAbs,
          manifest.docs.assetsDir,
          `${label} docs assets artifact path`,
        ),
        `${label} docs assets`,
        { sourceFilter: artifactCopyFilter },
      ),
    );
  }

  if (manifest.docs.generatedDir) {
    errors.push(
      ...collectTreeParityErrors(
        resolve(rootDir, "docs/generated"),
        resolveInside(
          artifactRootAbs,
          manifest.docs.generatedDir,
          `${label} docs generated artifact path`,
        ),
        `${label} docs generated`,
        { sourceFilter: artifactCopyFilter },
      ),
    );
  }

  errors.push(
    ...collectTreeParityErrors(
      resolve(rootDir, "public/r"),
      resolveInside(
        artifactRootAbs,
        manifest.registry.publicDir,
        `${label} public registry artifact path`,
      ),
      `${label} public/r`,
      { sourceFilter: artifactCopyFilter },
    ),
  );

  if (manifest.source?.registryDir) {
    errors.push(
      ...collectTreeParityErrors(
        resolve(rootDir, "registry"),
        resolveInside(
          artifactRootAbs,
          manifest.source.registryDir,
          `${label} source registry artifact path`,
        ),
        `${label} source registry`,
        { sourceFilter: artifactCopyFilter },
      ),
    );
  }

  if (manifest.source?.stylesDir) {
    errors.push(
      ...collectTreeParityErrors(
        resolve(rootDir, "styles"),
        resolveInside(
          artifactRootAbs,
          manifest.source.stylesDir,
          `${label} source styles artifact path`,
        ),
        `${label} source styles`,
        { sourceFilter: artifactCopyFilter },
      ),
    );
  }
}

export function validateLibraryArtifacts(options) {
  const {
    rootDir,
    label = rootDir,
    artifactRoot = "dist/artifacts",
    origin = process.env.REGISTRY_ORIGIN,
  } = options;
  const errors = [];
  let manifestRootAbs;
  try {
    manifestRootAbs = resolveInside(rootDir, artifactRoot, `${label} artifact root`);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const manifestPath = resolveInside(
    manifestRootAbs,
    "artifact-manifest.json",
    `${label} artifact manifest path`,
  );

  if (!existsSync(manifestPath)) {
    return [`${label}: missing artifact manifest at ${manifestPath}`];
  }

  const manifestResult = validateManifest(readJson(manifestPath));
  if (!manifestResult.success) {
    return [
      `${label} manifest validation failed:`,
      ...manifestResult.errors.map((error) => `${label}: ${error}`),
    ];
  }
  const manifest = manifestResult.data;

  let artifactRootAbs;
  try {
    artifactRootAbs = resolveInside(
      rootDir,
      manifest.artifactRoot,
      `${label} manifest artifact root`,
    );
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

  const resolvedOrigin = normalizeOrigin(origin, { defaultOrigin: REGISTRY_ORIGIN });
  const { fingerprint, missing } = computeStrictArtifactFingerprint(
    rootDir,
    manifest.inputs,
    resolvedOrigin,
  );
  for (const input of missing) {
    errors.push(`${label}: missing fingerprint input ${input}`);
  }
  if (recorded && fingerprint !== recorded) {
    errors.push(
      `${label}: artifact fingerprint mismatch; expected ${fingerprint}, found ${recorded}`,
    );
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
      errors.push(
        `${label}: bundle integrity mismatch; expected ${expected}, found ${bundle.integrity}`,
      );
    }
  }

  return errors;
}

export function collectBundleRelativeJsImportErrors(items, label) {
  const errors = [];

  for (const item of items ?? []) {
    for (const file of item?.files ?? []) {
      if (typeof file?.content !== "string") continue;
      const matches = file.content.match(new RegExp(RELATIVE_JS_IMPORT_RE.source, "g"));
      if (matches) {
        errors.push(
          `${label}: ${file.target ?? file.path} has relative .js import specifiers: ${matches.join(", ")}`,
        );
      }
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
