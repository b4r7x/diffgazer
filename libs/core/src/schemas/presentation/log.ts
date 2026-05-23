import { z } from "zod";

const LOG_TAG_TYPES = ["system", "tool", "lens", "warning", "error", "agent", "thinking"] as const;
const LogTagTypeSchema = z.enum(LOG_TAG_TYPES);
export type LogTagType = z.infer<typeof LogTagTypeSchema>;

const LogEntryDataSchema = z.object({
  id: z.string(),
  timestamp: z.union([z.date(), z.string()]),
  tag: z.string(),
  tagType: LogTagTypeSchema.optional(),
  message: z.string(),
  isWarning: z.boolean().optional(),
  source: z.string().optional(),
  isError: z.boolean().optional(),
});
export type LogEntryData = z.infer<typeof LogEntryDataSchema>;

/** @see libs/ui/registry/ui/badge/badge.tsx for the component-library copy. */
const BADGE_VARIANTS = ["success", "warning", "error", "info", "neutral"] as const;
const BadgeVariantSchema = z.enum(BADGE_VARIANTS);
export type BadgeVariant = z.infer<typeof BadgeVariantSchema>;

export const TAG_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  system: "neutral",
  agent: "info",
  tool: "info",
  lens: "info",
  warning: "warning",
  error: "error",
  thinking: "neutral",
};
