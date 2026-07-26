import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  getApiKeyMissingCopy,
} from "@diffgazer/core/review";
import type { AIProvider, SetupStatus } from "@diffgazer/core/schemas/config";
import { FailureView } from "@/components/shared/failure-view";

export interface ApiKeyMissingViewProps {
  activeProvider?: AIProvider;
  onNavigateSettings: () => void;
  onBack: () => void;
  missing: Readonly<SetupStatus["missing"]>;
  primaryDisabled?: boolean;
}

const REVIEW_SETUP_GATE_SCOPE = "review-setup-gate";

export function ApiKeyMissingView({
  activeProvider,
  onNavigateSettings,
  onBack,
  missing,
  primaryDisabled,
}: ApiKeyMissingViewProps) {
  const copy = getApiKeyMissingCopy({ provider: activeProvider, missing });

  return (
    <FailureView
      title={copy.title}
      message={copy.body}
      tone="warning"
      scope={REVIEW_SETUP_GATE_SCOPE}
      primary={{
        label: CONFIGURE_PROVIDER_LABEL,
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
