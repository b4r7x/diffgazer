import type { WriteOnlySecretInput } from "../schemas/config/provider-config.js";
import type { OnboardingConfigurationDraft, OnboardingDraft } from "./defaults.js";

function areSecretsEqual(
  left: WriteOnlySecretInput | undefined,
  right: WriteOnlySecretInput | undefined,
): boolean {
  if (left?.kind !== right?.kind) return false;
  if (left?.kind !== "literal" || right?.kind !== "literal") return true;
  return left.value === right.value;
}

export function areConfigurationInputsEqual(
  left: OnboardingConfigurationDraft,
  right: OnboardingConfigurationDraft,
): boolean {
  return (
    left.productId === right.productId &&
    left.endpoint === right.endpoint &&
    areSecretsEqual(left.credential, right.credential)
  );
}

function isSameConfigurationGeneration(left: OnboardingDraft, right: OnboardingDraft): boolean {
  return (
    left.plan.productId === right.plan.productId &&
    left.selectedModelId === right.selectedModelId &&
    areConfigurationInputsEqual(left.configurationInput, right.configurationInput)
  );
}

function areAcknowledgementsEqual(
  left: OnboardingDraft["acknowledgement"],
  right: OnboardingDraft["acknowledgement"],
): boolean {
  switch (left.status) {
    case "required":
      return right.status === "required";
    case "accepted":
      return (
        right.status === "accepted" &&
        left.noticeId === right.noticeId &&
        left.noticeVersion === right.noticeVersion &&
        left.acceptedAt === right.acceptedAt
      );
    default: {
      const _exhaustive: never = left;
      return _exhaustive;
    }
  }
}

export function areDraftsEqual(left: OnboardingDraft, right: OnboardingDraft): boolean {
  return (
    isSameConfigurationGeneration(left, right) &&
    areAcknowledgementsEqual(left.acknowledgement, right.acknowledgement) &&
    left.agentExecution === right.agentExecution &&
    left.defaultLenses.length === right.defaultLenses.length &&
    left.defaultLenses.every((lens, index) => lens === right.defaultLenses[index])
  );
}
