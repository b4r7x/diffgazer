import { z } from "zod";
import {
  AgentExecutionSchema,
  ClientConfigurationInputSchema,
  ExactModelIdSchema,
} from "../schemas/config/index.js";
import { LensIdSchema } from "../schemas/review/index.js";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";

/**
 * How a user supplies an API key: pasted literally, or named as an environment
 * variable. Shared by `useApiKeyEntry` and the Web/TUI method selectors through
 * the `@diffgazer/core/onboarding` entry.
 */
export type InputMethod = "paste" | "env";

export const ONBOARDING_CONFORMANCE_STATUSES = [
  "not-tested",
  "pending",
  "passed",
  "failed",
] as const;
export const OnboardingConformanceStatusSchema = z.enum(ONBOARDING_CONFORMANCE_STATUSES);
export type OnboardingConformanceStatus = z.infer<typeof OnboardingConformanceStatusSchema>;

export const OnboardingAcknowledgementSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("required") }),
  z.strictObject({
    status: z.literal("accepted"),
    noticeId: z.string().min(1).max(128),
    noticeVersion: z.number().int().positive(),
    acceptedAt: z.iso.datetime(),
  }),
]);
export type OnboardingAcknowledgement = z.infer<typeof OnboardingAcknowledgementSchema>;

const OnboardingPreferencesShape = {
  defaultLenses: z
    .array(LensIdSchema)
    .min(1)
    .overwrite((lenses) => [...new Set(lenses)]),
  agentExecution: AgentExecutionSchema,
} as const;

// `ClientConfigurationInputSchema` admits only runnable product IDs, so the
// plan is built once here and every later rule reads it off the parsed state.
export const OnboardingStateSchema = z
  .strictObject({
    kind: z.literal("runnable"),
    configurationInput: ClientConfigurationInputSchema,
    selectedModelId: ExactModelIdSchema.nullable(),
    conformanceStatus: OnboardingConformanceStatusSchema,
    acknowledgement: OnboardingAcknowledgementSchema,
    ...OnboardingPreferencesShape,
  })
  .transform((state) => ({
    ...state,
    plan: buildSetupPlan(state.configurationInput.productId) satisfies RunnableSetupPlan,
  }))
  .superRefine((state, context) => {
    if (state.acknowledgement.status !== "accepted") return;
    const notice = state.plan.steps.find((step) => step.id === "acknowledgement")?.notice;
    if (
      state.acknowledgement.noticeId !== notice?.id ||
      state.acknowledgement.noticeVersion !== notice?.noticeVersion
    ) {
      context.addIssue({
        code: "custom",
        message: "Acknowledgement must match the selected product notice",
        path: ["acknowledgement"],
      });
    }
  });

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

export type OnboardingStep = OnboardingState["plan"]["steps"][number]["id"];
