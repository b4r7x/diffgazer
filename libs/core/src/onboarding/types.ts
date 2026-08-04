import { z } from "zod";
import {
  AgentExecutionSchema,
  ClientConfigurationInputSchema,
  ExactModelIdSchema,
} from "../schemas/config/index.js";
import { LensIdSchema } from "../schemas/review/index.js";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";

/**
 * @deprecated Internal compatibility type for the legacy API-key entry hook.
 * V2 onboarding carries family-specific credential input in configurationInput
 * and does not expose this type from the onboarding package entrypoint.
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

const RunnableOnboardingStateInputSchema = z
  .strictObject({
    kind: z.literal("runnable"),
    configurationInput: ClientConfigurationInputSchema,
    selectedModelId: ExactModelIdSchema.nullable(),
    conformanceStatus: OnboardingConformanceStatusSchema,
    acknowledgement: OnboardingAcknowledgementSchema,
    ...OnboardingPreferencesShape,
  })
  .superRefine((state, context) => {
    const plan = buildSetupPlan(state.configurationInput.productId);
    if (!plan) {
      context.addIssue({ code: "custom", message: "Runnable product requires a setup plan" });
      return;
    }

    if (state.acknowledgement.status !== "accepted") return;
    const notice = plan.steps.find((step) => step.id === "acknowledgement")?.notice;
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

export const OnboardingStateSchema = RunnableOnboardingStateInputSchema.transform((state) => {
  const plan = buildSetupPlan(state.configurationInput.productId);
  if (!plan) {
    throw new Error(`Missing runnable setup plan for ${state.configurationInput.productId}`);
  }
  return { ...state, plan } satisfies z.infer<typeof RunnableOnboardingStateInputSchema> & {
    readonly plan: RunnableSetupPlan;
  };
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

export type OnboardingStep = OnboardingState["plan"]["steps"][number]["id"];
