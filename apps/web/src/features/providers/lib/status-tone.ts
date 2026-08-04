import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";

/**
 * Status tone per semantic display variant, shared by the list status chips and the details
 * header readout so the two surfaces cannot split the status vocabulary. Both surfaces publish
 * the variant they resolved as `data-tone`, which is what their tests assert; these class names
 * stay private styling.
 */
export const PROVIDER_STATUS_TONE: Record<BadgeVariant, string> = {
  success: "text-success-text",
  warning: "text-warning-text",
  error: "text-error-text",
  info: "text-info-text",
  neutral: "text-muted-foreground",
};
