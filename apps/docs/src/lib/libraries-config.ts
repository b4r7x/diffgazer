import { z } from "zod";
import rawConfig from "../../config/docs-libraries.json";

const ArtifactSourceSchema = z.object({
  workspaceDir: z.string().min(1),
  packageName: z.string().min(1),
});

const InstallerSchema = z.object({
  command: z.string().min(1),
  itemPrefix: z.string().optional(),
});

const DocsLibraryConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  logoText: z.string().min(1),
  githubUrl: z.url(),
  enabled: z.boolean(),
  defaultRouteSlugs: z.array(z.string()),
  installer: InstallerSchema.optional(),
  artifactSource: ArtifactSourceSchema.optional(),
});

export const DocsLibrariesConfigSchema = z
  .object({
    primaryLibraryId: z.string().min(1),
    libraries: z.array(DocsLibraryConfigSchema).min(1),
  })
  .refine((config) => config.libraries.some((library) => library.id === config.primaryLibraryId), {
    error: "primaryLibraryId must match one of libraries[].id",
    path: ["primaryLibraryId"],
  });

export type ArtifactSourceConfig = z.infer<typeof ArtifactSourceSchema>;
export type DocsLibraryConfigData = z.infer<typeof DocsLibraryConfigSchema>;

export const docsLibrariesConfig = DocsLibrariesConfigSchema.parse(rawConfig);
