import { z } from "zod";
import { isRelativeSubpath } from "../utils/fs.js";
import { readJson } from "../utils/json.js";
import { assertSafeLibraryId } from "./library-id-validation.js";

export interface ArtifactLibrary {
  id: string;
  workspaceDir: string;
}

interface ArtifactSourceConfig {
  workspaceDir: string;
}

interface DocsLibraryConfig {
  id: string;
  enabled: boolean;
  artifactSource?: ArtifactSourceConfig;
}

export interface DocsLibrariesConfig {
  primaryLibraryId: string;
  libraries: DocsLibraryConfig[];
}

const nonEmptyStringSchema = z.string().min(1, { error: "must be a non-empty string" });

const artifactSourceConfigSchema = z.object({
  workspaceDir: nonEmptyStringSchema.refine(isRelativeSubpath, {
    error: "must be a relative path without '..' segments",
  }),
});

const docsLibraryConfigSchema = z.object({
  id: nonEmptyStringSchema.refine(
    (id) => {
      try {
        assertSafeLibraryId(id, "library id");
        return true;
      } catch {
        return false;
      }
    },
    { error: "must be a safe library id" },
  ),
  enabled: z.boolean({ error: "must be a boolean" }),
  artifactSource: artifactSourceConfigSchema.optional(),
});

const docsLibrariesConfigSchema = z.object({
  primaryLibraryId: nonEmptyStringSchema.refine(
    (id) => {
      try {
        assertSafeLibraryId(id, "primaryLibraryId");
        return true;
      } catch {
        return false;
      }
    },
    { error: "must be a safe library id" },
  ),
  libraries: z
    .array(docsLibraryConfigSchema, { error: "must be a non-empty array" })
    .min(1, { error: "must be a non-empty array" })
    .superRefine((libraries, context) => {
      const seenIds = new Set<string>();
      for (const [index, library] of libraries.entries()) {
        if (seenIds.has(library.id)) {
          context.addIssue({
            code: "custom",
            path: [index, "id"],
            message: `duplicates library id "${library.id}"`,
          });
        }
        seenIds.add(library.id);
      }
    }),
});

function formatConfigPath(path: PropertyKey[]): string {
  let formatted = "docs libraries config";
  for (const segment of path) {
    if (typeof segment === "number") {
      formatted += `[${segment}]`;
      continue;
    }
    const key = String(segment);
    formatted += formatted === "docs libraries config" ? ` ${key}` : `.${key}`;
  }
  return formatted;
}

function formatConfigIssue(issue: z.core.$ZodIssue): string {
  if (issue.path.length === 0) return "docs libraries config must be an object";
  return `${formatConfigPath(issue.path)} ${issue.message}`;
}

export function parseDocsLibrariesConfig(rawConfig: unknown): DocsLibrariesConfig {
  const result = docsLibrariesConfigSchema.safeParse(rawConfig);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new Error(issue ? formatConfigIssue(issue) : "docs libraries config must be an object");
}

export function readDocsLibrariesConfig(configPath: string): DocsLibrariesConfig {
  return parseDocsLibrariesConfig(readJson(configPath));
}

export function getArtifactLibraries(docsLibraries: DocsLibrariesConfig): ArtifactLibrary[] {
  return docsLibraries.libraries.flatMap((library) => {
    if (!library.enabled || !library.artifactSource) return [];
    return [
      {
        id: library.id,
        workspaceDir: library.artifactSource.workspaceDir,
      },
    ];
  });
}
