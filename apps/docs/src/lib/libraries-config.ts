import { z } from "zod";
import rawConfig from "../../config/docs-libraries.json";

export const DOCS_LIBRARY_ID_VALUES = ["app", "ui", "keys"] as const;
export type DocsLibraryId = (typeof DOCS_LIBRARY_ID_VALUES)[number];

const ArtifactSourceSchema = z.object({
  workspaceDir: z.string().min(1),
});

const DocsLibraryConfigSchema = z.object({
  id: z.enum(DOCS_LIBRARY_ID_VALUES),
  displayName: z.string().min(1),
  logoText: z.string().min(1),
  githubUrl: z.url(),
  enabled: z.boolean(),
  defaultRouteSlugs: z.array(z.string()),
  artifactSource: ArtifactSourceSchema.optional(),
});

export const DocsLibrariesConfigSchema = z
  .object({
    primaryLibraryId: z.enum(DOCS_LIBRARY_ID_VALUES),
    libraries: z.array(DocsLibraryConfigSchema).min(1),
  })
  .refine((config) => config.libraries.some((library) => library.id === config.primaryLibraryId), {
    error: "primaryLibraryId must match one of libraries[].id",
    path: ["primaryLibraryId"],
  })
  .refine(
    (config) =>
      new Set(config.libraries.map((library) => library.id)).size === config.libraries.length,
    {
      error: "libraries[].id values must be unique",
      path: ["libraries"],
    },
  )
  .refine(
    (config) =>
      config.libraries.find((library) => library.id === config.primaryLibraryId)?.enabled === true,
    {
      error: "primaryLibraryId must refer to an enabled library",
      path: ["primaryLibraryId"],
    },
  );

export type ArtifactSourceConfig = z.infer<typeof ArtifactSourceSchema>;
export type DocsLibraryConfigData = z.infer<typeof DocsLibraryConfigSchema>;

export const docsLibrariesConfig = DocsLibrariesConfigSchema.parse(rawConfig);
