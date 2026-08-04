import type { OnboardingConfigurationDraft, OnboardingDraft } from "./defaults.js";

type WriteOnlySecret =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "environment" };

function areSecretsEqual(
  left: WriteOnlySecret | undefined,
  right: WriteOnlySecret | undefined,
): boolean {
  if (left?.kind !== right?.kind) return false;
  if (left?.kind !== "literal" || right?.kind !== "literal") return true;
  return left.value === right.value;
}

export function areConfigurationInputsEqual(
  left: OnboardingConfigurationDraft,
  right: OnboardingConfigurationDraft,
): boolean {
  if (left.transportFamily !== right.transportFamily || left.productId !== right.productId) {
    return false;
  }

  if (left.transportFamily === "hosted-api" && right.transportFamily === "hosted-api") {
    return (
      left.endpoint === right.endpoint &&
      left.region === right.region &&
      left.workspace === right.workspace &&
      areSecretsEqual(left.credential, right.credential)
    );
  }

  if (left.transportFamily === "local-http" && right.transportFamily === "local-http") {
    return (
      left.endpoint === right.endpoint &&
      left.authentication === right.authentication &&
      left.presetId === right.presetId &&
      areSecretsEqual(left.bearerToken, right.bearerToken)
    );
  }

  if (left.transportFamily === "local-cli" && right.transportFamily === "local-cli") {
    return left.installationId === right.installationId;
  }

  return false;
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
  if (left.status !== right.status) return false;
  if (left.status === "required" && right.status === "required") return true;
  return (
    left.status === "accepted" &&
    right.status === "accepted" &&
    left.noticeId === right.noticeId &&
    left.noticeVersion === right.noticeVersion &&
    left.acceptedAt === right.acceptedAt
  );
}

export function areDraftsEqual(left: OnboardingDraft, right: OnboardingDraft): boolean {
  return (
    isSameConfigurationGeneration(left, right) &&
    left.conformanceStatus === right.conformanceStatus &&
    areAcknowledgementsEqual(left.acknowledgement, right.acknowledgement) &&
    left.agentExecution === right.agentExecution &&
    left.defaultLenses.length === right.defaultLenses.length &&
    left.defaultLenses.every((lens, index) => lens === right.defaultLenses[index])
  );
}

export function scrubLiteralSecret(data: OnboardingDraft): OnboardingDraft {
  const configurationInput = { ...data.configurationInput };
  if (
    configurationInput.transportFamily === "hosted-api" &&
    configurationInput.credential?.kind === "literal"
  ) {
    delete configurationInput.credential;
  }
  if (
    configurationInput.transportFamily === "local-http" &&
    configurationInput.bearerToken?.kind === "literal"
  ) {
    delete configurationInput.bearerToken;
  }
  return { ...data, configurationInput };
}
