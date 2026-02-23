import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeOrigin,
  syncDocsFromArtifacts,
} from "@b4r7x/registry-kit";
import { z } from "zod";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../../..");
const DOCS_LIBRARIES_CONFIG_PATH = resolve(DOCS_ROOT, "config/docs-libraries.json");

const DocsLibrariesSchema = z.object({
  primaryLibraryId: z.string().min(1),
  libraries: z.array(z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    artifactSource: z.object({
      workspaceDir: z.string().min(1),
      packageName: z.string().min(1),
    }).optional(),
  })),
});

const docsLibraries = DocsLibrariesSchema.parse(
  JSON.parse(readFileSync(DOCS_LIBRARIES_CONFIG_PATH, "utf-8")),
);

const artifactLibraries = docsLibraries.libraries
  .filter((library) => library.enabled && library.artifactSource)
  .map((library) => ({
    id: library.id,
    packageName: library.artifactSource.packageName,
    workspaceDir: library.artifactSource.workspaceDir,
  }));

syncDocsFromArtifacts({
  docsRoot: DOCS_ROOT,
  workspaceRoot: WORKSPACE_ROOT,
  libraries: artifactLibraries,
  primaryLibraryId: docsLibraries.primaryLibraryId,
  origin: normalizeOrigin(process.env.REGISTRY_ORIGIN),
  mode: process.env.DIFFGAZER_DEV ? "workspace" : "package",
});
