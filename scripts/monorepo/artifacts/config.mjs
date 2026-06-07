import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readJson } from "./json.mjs";
import { isRelativeSubpath } from "./paths.mjs";

const LIBRARY_ID_RE = /^[a-z0-9][a-z0-9-]*$/i;
const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;

export function assertSafeLibraryId(id, label) {
  if (typeof id === "string" && LIBRARY_ID_RE.test(id)) return;
  throw new Error(`${label} must be a safe library id`);
}

function assertRelativeSubpath(path, label) {
  if (isRelativeSubpath(path)) return;
  throw new Error(`${label} must be a relative path without '..' segments`);
}

function assertPackageName(name, label) {
  if (typeof name === "string" && PACKAGE_NAME_RE.test(name)) return;
  throw new Error(`${label} must be an npm package name`);
}

export function parseDocsLibrariesConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throw new Error("docs libraries config must be an object");
  }
  if (typeof rawConfig.primaryLibraryId !== "string" || rawConfig.primaryLibraryId.length === 0) {
    throw new Error("docs libraries config primaryLibraryId must be a non-empty string");
  }
  assertSafeLibraryId(rawConfig.primaryLibraryId, "docs libraries config primaryLibraryId");
  if (!Array.isArray(rawConfig.libraries) || rawConfig.libraries.length === 0) {
    throw new Error("docs libraries config libraries must be a non-empty array");
  }

  return {
    primaryLibraryId: rawConfig.primaryLibraryId,
    libraries: rawConfig.libraries.map((library, index) => {
      if (!library || typeof library !== "object" || Array.isArray(library)) {
        throw new Error(`docs libraries config libraries[${index}] must be an object`);
      }
      if (typeof library.id !== "string" || library.id.length === 0) {
        throw new Error(`docs libraries config libraries[${index}].id must be a non-empty string`);
      }
      assertSafeLibraryId(library.id, `docs libraries config libraries[${index}].id`);
      if (typeof library.enabled !== "boolean") {
        throw new Error(`docs libraries config libraries[${index}].enabled must be a boolean`);
      }

      if (library.artifactSource === undefined) {
        return { id: library.id, enabled: library.enabled };
      }
      if (
        !library.artifactSource ||
        typeof library.artifactSource !== "object" ||
        Array.isArray(library.artifactSource)
      ) {
        throw new Error(
          `docs libraries config libraries[${index}].artifactSource must be an object`,
        );
      }
      if (
        typeof library.artifactSource.workspaceDir !== "string" ||
        library.artifactSource.workspaceDir.length === 0
      ) {
        throw new Error(
          `docs libraries config libraries[${index}].artifactSource.workspaceDir must be a non-empty string`,
        );
      }
      assertRelativeSubpath(
        library.artifactSource.workspaceDir,
        `docs libraries config libraries[${index}].artifactSource.workspaceDir`,
      );
      if (
        typeof library.artifactSource.packageName !== "string" ||
        library.artifactSource.packageName.length === 0
      ) {
        throw new Error(
          `docs libraries config libraries[${index}].artifactSource.packageName must be a non-empty string`,
        );
      }
      assertPackageName(
        library.artifactSource.packageName,
        `docs libraries config libraries[${index}].artifactSource.packageName`,
      );

      return {
        id: library.id,
        enabled: library.enabled,
        artifactSource: {
          workspaceDir: library.artifactSource.workspaceDir,
          packageName: library.artifactSource.packageName,
        },
      };
    }),
  };
}

export function readDocsLibrariesConfig(configPath) {
  return parseDocsLibrariesConfig(readJson(configPath));
}

export function getArtifactLibraries(docsLibraries) {
  return docsLibraries.libraries
    .filter((library) => library.enabled && library.artifactSource)
    .map((library) => ({
      id: library.id,
      packageName: library.artifactSource.packageName,
      workspaceDir: library.artifactSource.workspaceDir,
    }));
}

function makePackageResolver(resolveFromDir) {
  const requireFromDir = createRequire(resolve(resolveFromDir, "__docs-artifacts-resolver__.cjs"));

  return (packageName) => {
    try {
      requireFromDir.resolve(packageName);
      return true;
    } catch {
      return false;
    }
  };
}

export function resolveArtifactSyncMode(env = process.env, options = {}) {
  if (env.DIFFGAZER_DEV) return "workspace";

  const {
    libraries = [],
    resolveFromDir = process.cwd(),
    resolvePackage = makePackageResolver(resolveFromDir),
  } = options;

  if (env.CI) return "package";
  if (libraries.length === 0) return "package";

  const hasUnresolvableArtifactPackage = libraries.some(
    (library) => !resolvePackage(library.packageName),
  );

  return hasUnresolvableArtifactPackage ? "workspace" : "package";
}
