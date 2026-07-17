import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import {
  collectArtifactSyncValidationErrors,
  collectTreeParityErrors,
  rewriteDemoIndexForViteGlob,
} from "@diffgazer/registry";
import { resolveInside, toPosixPath } from "./paths.mjs";

const SOURCE_ARCHIVE_SUFFIX = ".source.json";
const SOURCE_DATA_KINDS = new Set(["components", "hooks"]);

function collectFiles(dirPath) {
  if (!existsSync(dirPath)) return [];

  return readdirSync(dirPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = resolve(dirPath, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function isSourceArchive(path) {
  return path.endsWith(SOURCE_ARCHIVE_SUFFIX);
}

function sourceArchiveForSidecar(path) {
  for (const suffix of [".gz", ".br"]) {
    if (path.endsWith(`${SOURCE_ARCHIVE_SUFFIX}${suffix}`)) {
      return path.slice(0, -suffix.length);
    }
  }
  return null;
}

function artifactWithoutLegacySourceParity(artifact, primaryLibraryId) {
  const demoIndex = artifact.manifest.generated?.demoIndex;

  if (artifact.id !== primaryLibraryId) {
    return {
      ...artifact,
      generatedFiles: typeof demoIndex === "string" ? [demoIndex] : [],
    };
  }

  return {
    ...artifact,
    manifest: {
      ...artifact.manifest,
      docs: {
        ...artifact.manifest.docs,
        generatedDir: undefined,
      },
    },
  };
}

function collectPrimaryDemoIndexErrors(docsRoot, artifact) {
  const demoIndex = artifact.manifest.generated?.demoIndex;
  if (typeof demoIndex !== "string") return [];

  const sourcePath = resolveInside(
    artifact.artifactRoot,
    demoIndex,
    `${artifact.id} generated demo index artifact path`,
  );
  const outputPath = resolve(docsRoot, "src/generated", artifact.id, basename(demoIndex));
  const label = `${artifact.id} generated sync demo-index.ts`;

  if (!existsSync(sourcePath)) return [`${label}: missing source path ${sourcePath}`];
  if (!existsSync(outputPath)) return [`${label}: missing artifact path ${outputPath}`];

  const expected = rewriteDemoIndexForViteGlob(readFileSync(sourcePath, "utf8"));
  return readFileSync(outputPath, "utf8") === expected
    ? []
    : [`${label}: artifact differs from rewritten docs runtime demo index`];
}

function collectGeneratedOutputErrors({ docsRoot, primaryLibraryId, artifacts = [] }) {
  const errors = [];
  const isRuntimeGeneratedFile = (path) =>
    !isSourceArchive(path) && basename(path) !== "demo-index.ts";

  for (const artifact of artifacts) {
    const generatedDir = artifact.manifest.docs?.generatedDir;
    if (typeof generatedDir !== "string") continue;

    try {
      const sourceDir = resolveInside(
        artifact.artifactRoot,
        generatedDir,
        `${artifact.id} generated artifact path`,
      );
      const outputDir = resolve(docsRoot, "src/generated", artifact.id);
      errors.push(
        ...collectTreeParityErrors(sourceDir, outputDir, `${artifact.id} generated sync`, {
          sourceFilter: isRuntimeGeneratedFile,
          artifactFilter: isRuntimeGeneratedFile,
        }),
      );

      if (artifact.id === primaryLibraryId) {
        errors.push(...collectPrimaryDemoIndexErrors(docsRoot, artifact));
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return errors;
}

function collectExpectedPublicSourceArchives(artifacts, errors) {
  const expected = new Map();

  for (const artifact of artifacts) {
    const generatedDir = artifact.manifest.docs?.generatedDir;
    if (typeof generatedDir !== "string") continue;

    let generatedRoot;
    try {
      generatedRoot = resolveInside(
        artifact.artifactRoot,
        generatedDir,
        `${artifact.id} generated artifact path`,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    for (const sourcePath of collectFiles(generatedRoot).filter(isSourceArchive)) {
      const artifactRelativePath = toPosixPath(relative(generatedRoot, sourcePath));
      const segments = artifactRelativePath.split("/");
      if (segments.length !== 2 || !SOURCE_DATA_KINDS.has(segments[0])) {
        errors.push(
          `${artifact.id} source archive must live directly under components/ or hooks/: ${artifactRelativePath}`,
        );
        continue;
      }

      expected.set(`${artifact.id}/${artifactRelativePath}`, sourcePath);
    }
  }

  return expected;
}

function collectPublicSourceDataErrors({ docsRoot, artifacts = [] }) {
  const errors = [];
  const expected = collectExpectedPublicSourceArchives(artifacts, errors);
  const publicRoot = resolve(docsRoot, "public/source-data");
  const actualFiles = collectFiles(publicRoot);
  const actualRawFiles = new Set(
    actualFiles.filter(isSourceArchive).map((path) => toPosixPath(relative(publicRoot, path))),
  );

  for (const [relativePath, sourcePath] of expected) {
    let publicPath;
    try {
      publicPath = resolveInside(publicRoot, relativePath, "docs public source-data path");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (!existsSync(publicPath)) {
      errors.push(`docs source-data: missing public source archive ${relativePath}`);
      continue;
    }
    if (!readFileSync(sourcePath).equals(readFileSync(publicPath))) {
      errors.push(`docs source-data: public source archive differs from artifact ${relativePath}`);
    }
  }

  for (const publicPath of actualFiles) {
    const relativePath = toPosixPath(relative(publicRoot, publicPath));
    if (isSourceArchive(publicPath)) {
      if (!expected.has(relativePath)) {
        errors.push(`docs source-data: extra public source archive ${relativePath}`);
      }
      continue;
    }

    const rawPath = sourceArchiveForSidecar(relativePath);
    if (rawPath) {
      if (!actualRawFiles.has(rawPath) && !expected.has(rawPath)) {
        errors.push(
          `docs source-data: compressed sidecar has no raw source archive ${relativePath}`,
        );
      }
      continue;
    }

    errors.push(`docs source-data: extra public source-data file ${relativePath}`);
  }

  const generatedRoot = resolve(docsRoot, "src/generated");
  for (const oldSourcePath of collectFiles(generatedRoot).filter(isSourceArchive)) {
    errors.push(
      `docs generated output contains source archive: ${toPosixPath(relative(generatedRoot, oldSourcePath))}`,
    );
  }

  return errors;
}

export function collectDocsArtifactSyncValidationErrors(params) {
  const artifacts = params.artifacts ?? [];
  const legacyArtifacts = artifacts.map((artifact) =>
    artifactWithoutLegacySourceParity(artifact, params.primaryLibraryId),
  );

  return [
    ...collectArtifactSyncValidationErrors({ ...params, artifacts: legacyArtifacts }),
    ...collectGeneratedOutputErrors({ ...params, artifacts }),
    ...collectPublicSourceDataErrors({ ...params, artifacts }),
  ];
}
