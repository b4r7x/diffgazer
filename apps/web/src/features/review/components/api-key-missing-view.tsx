import {
  CONFIGURATION_ERROR_COPY,
  describeTerminalOutcome,
  describeUsageAvailability,
  getConfigurationNotReadyCopy,
  sanitizePresentationText,
} from "@diffgazer/core/review";
import type { Readiness } from "@diffgazer/core/schemas/config";
import type { TerminalOutcome, UsageAvailability } from "@diffgazer/core/schemas/review";
import { FailureView } from "@/components/shared/failure-view";

export interface ApiKeyMissingViewProps {
  readiness: Readiness;
  productLabel?: string;
  primaryLabel: string;
  onNavigateSettings: () => void;
  onBack: () => void;
  primaryDisabled?: boolean;
}

const REVIEW_SETUP_GATE_SCOPE = "review-setup-gate";

export function ApiKeyMissingView({
  readiness,
  productLabel,
  primaryLabel,
  onNavigateSettings,
  onBack,
  primaryDisabled,
}: ApiKeyMissingViewProps) {
  const copy = getConfigurationNotReadyCopy({ productLabel, readiness });

  return (
    <FailureView
      title={copy.title}
      message={copy.body}
      tone="warning"
      scope={REVIEW_SETUP_GATE_SCOPE}
      primary={{
        label: primaryLabel,
        onAction: onNavigateSettings,
        disabled: primaryDisabled,
      }}
      secondary={{ label: "Back to Home", onAction: onBack }}
    />
  );
}

export function ConfigurationErrorView({
  onRetry,
  onBack,
  primaryDisabled,
}: {
  onRetry: () => void;
  onBack: () => void;
  primaryDisabled?: boolean;
}) {
  return (
    <FailureView
      title={CONFIGURATION_ERROR_COPY.title}
      message={CONFIGURATION_ERROR_COPY.body}
      scope={REVIEW_SETUP_GATE_SCOPE}
      primary={{ label: "Retry", onAction: onRetry, disabled: primaryDisabled }}
      secondary={{ label: "Back to Home", onAction: onBack }}
    />
  );
}

export function ReviewTerminalReceiptView({
  outcome,
  usageAvailability,
  onBack,
}: {
  outcome: TerminalOutcome;
  usageAvailability?: UsageAvailability;
  onBack: () => void;
}) {
  const { title, message } = describeTerminalOutcome(outcome);
  const usage = usageAvailability ? describeUsageAvailability(usageAvailability) : null;

  return (
    <FailureView
      title={title}
      message={usage ? `${message} ${usage.label}: ${usage.detail}` : message}
      tone="error"
      scope={REVIEW_SETUP_GATE_SCOPE}
      primary={{ label: "Back to Home", onAction: onBack }}
    />
  );
}

export function ReviewTerminalErrorView({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <FailureView
      title="Review failed"
      message={sanitizePresentationText(message)}
      tone="error"
      scope={REVIEW_SETUP_GATE_SCOPE}
      primary={{ label: "Back to Home", onAction: onBack }}
    />
  );
}
