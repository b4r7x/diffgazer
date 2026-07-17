import { z } from "zod";

export type LogTagType = "system" | "tool" | "lens" | "warning" | "error" | "agent" | "thinking";

export interface LogEntryData {
  id: string;
  timestamp: Date | string;
  tag: string;
  tagType?: LogTagType;
  message: string;
  isWarning?: boolean;
  source?: string;
  isError?: boolean;
}

/** @see libs/ui/registry/ui/badge/badge.tsx for the component-library copy. */
const BADGE_VARIANTS = ["success", "warning", "error", "info", "neutral"] as const;
export const BadgeVariantSchema = z.enum(BADGE_VARIANTS);
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
