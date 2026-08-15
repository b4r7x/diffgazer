import { type RefinementCtx, z } from "zod";
import { ExecutionNonnegativeIntegerSchema } from "./execution-identity.js";

type NormalizedUsageShape = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
};

function validateNormalizedUsage(
  usage: NormalizedUsageShape,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (
    usage.totalTokens !== undefined &&
    ((usage.inputTokens !== undefined && usage.totalTokens < usage.inputTokens) ||
      (usage.outputTokens !== undefined && usage.totalTokens < usage.outputTokens) ||
      (usage.cachedTokens !== undefined && usage.totalTokens < usage.cachedTokens) ||
      (usage.reasoningTokens !== undefined && usage.totalTokens < usage.reasoningTokens))
  ) {
    context.addIssue({
      code: "custom",
      message: "Total tokens cannot be less than a reported component",
      path: ["totalTokens"],
    });
  }
  if (
    usage.inputTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.totalTokens !== undefined &&
    usage.totalTokens !== usage.inputTokens + usage.outputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Total tokens must equal input plus output tokens",
      path: ["totalTokens"],
    });
  }
  if (
    usage.cachedTokens !== undefined &&
    usage.inputTokens !== undefined &&
    usage.cachedTokens > usage.inputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Cached tokens cannot exceed input tokens",
      path: ["cachedTokens"],
    });
  }
  if (
    usage.reasoningTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.reasoningTokens > usage.outputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Reasoning tokens cannot exceed output tokens",
      path: ["reasoningTokens"],
    });
  }
}

export const NormalizedUsageSchema = z
  .strictObject({
    inputTokens: ExecutionNonnegativeIntegerSchema.optional(),
    outputTokens: ExecutionNonnegativeIntegerSchema.optional(),
    totalTokens: ExecutionNonnegativeIntegerSchema.optional(),
    cachedTokens: ExecutionNonnegativeIntegerSchema.optional(),
    reasoningTokens: ExecutionNonnegativeIntegerSchema.optional(),
  })
  .refine((usage) => Object.values(usage).some((value) => value !== undefined), {
    error: "Reported usage must contain at least one value",
  })
  .superRefine(validateNormalizedUsage)
  .readonly();
export type NormalizedUsage = z.infer<typeof NormalizedUsageSchema>;

export const USAGE_AVAILABILITY = ["reported", "required-missing", "unavailable"] as const;
export const UsageAvailabilitySchema = z.enum(USAGE_AVAILABILITY);
export type UsageAvailability = z.infer<typeof UsageAvailabilitySchema>;

export const ExecutionReportedUsageStateShape = {
  usageAvailability: z.literal("reported"),
  usage: NormalizedUsageSchema,
} as const;

export const ExecutionMissingRequiredUsageStateShape = {
  usageAvailability: z.literal("required-missing"),
  usage: z.never().optional(),
} as const;

export const ExecutionUnavailableUsageStateShape = {
  usageAvailability: z.literal("unavailable"),
  usage: z.never().optional(),
} as const;

export const ExecutionReceiptUsageStateSchema = z
  .discriminatedUnion("usageAvailability", [
    z.strictObject(ExecutionReportedUsageStateShape),
    z.strictObject(ExecutionMissingRequiredUsageStateShape),
    z.strictObject(ExecutionUnavailableUsageStateShape),
  ])
  .readonly();
export type ExecutionReceiptUsageState = z.infer<typeof ExecutionReceiptUsageStateSchema>;
