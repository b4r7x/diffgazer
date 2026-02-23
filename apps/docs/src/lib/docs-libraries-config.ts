import { z } from "zod";
import rawConfig from "../../config/docs-libraries.json";

const ArtifactSourceSchema = z.object({
  workspaceDir: z.string().min(1),
  packageName: z.string().min(1),
});

const DocsLibraryConfigSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  logoText: z.string().min(1),
  githubUrl: z.string().url(),
  enabled: z.boolean(),
  defaultRouteSlugs: z.array(z.string()),
  artifactSource: ArtifactSourceSchema.optional(),
});

const DocsLibrariesConfigSchema = z.object({
  primaryLibraryId: z.string().min(1),
  libraries: z.array(DocsLibraryConfigSchema).min(1),
});

export type ArtifactSourceConfig = z.infer<typeof ArtifactSourceSchema>;
export type DocsLibraryConfigData = z.infer<typeof DocsLibraryConfigSchema>;
export type DocsLibrariesConfigData = z.infer<typeof DocsLibrariesConfigSchema>;

export const docsLibrariesConfig = DocsLibrariesConfigSchema.parse(rawConfig);
