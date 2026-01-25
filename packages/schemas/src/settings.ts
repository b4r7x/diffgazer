import { z } from "zod";
import { LensIdSchema, ProfileIdSchema } from "./lens.js";
import { TriageSeveritySchema } from "./triage.js";

export const TrustCapabilitiesSchema = z.object({
  readFiles: z.boolean(),
  readGit: z.boolean(),
  runCommands: z.boolean(),
});
export type TrustCapabilities = z.infer<typeof TrustCapabilitiesSchema>;

export const TRUST_MODES = ["persistent", "session"] as const;
export const TrustModeSchema = z.enum(TRUST_MODES);
export type TrustMode = z.infer<typeof TrustModeSchema>;

export const TrustConfigSchema = z.object({
  projectId: z.string(),
  repoRoot: z.string(),
  trustedAt: z.string().datetime(),
  capabilities: TrustCapabilitiesSchema,
  trustMode: TrustModeSchema,
});
export type TrustConfig = z.infer<typeof TrustConfigSchema>;

export const THEMES = ["auto", "dark", "light", "terminal"] as const;
export const ThemeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof ThemeSchema>;

export const CONTROLS_MODES = ["menu", "keys"] as const;
export const ControlsModeSchema = z.enum(CONTROLS_MODES);
export type ControlsMode = z.infer<typeof ControlsModeSchema>;

export const SettingsConfigSchema = z.object({
  theme: ThemeSchema,
  controlsMode: ControlsModeSchema,
  defaultLenses: z.array(LensIdSchema),
  defaultProfile: ProfileIdSchema.nullable(),
  severityThreshold: TriageSeveritySchema,
});
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;
