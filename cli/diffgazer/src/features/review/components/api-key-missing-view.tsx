import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  getApiKeyMissingCopy,
} from "@diffgazer/core/review";
import type { Readiness } from "@diffgazer/core/schemas/config";
import { ReviewGateView } from "./review-gate-view";

export interface ApiKeyMissingViewProps {
  productLabel?: string;
  readiness: Readiness;
  onGoToSettings: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export interface ConfigurationErrorViewProps {
  onRetry: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export function ApiKeyMissingView({
  productLabel,
  readiness,
  onGoToSettings,
  onBack,
  disabled = false,
}: ApiKeyMissingViewProps) {
  const { title, body } = getApiKeyMissingCopy({ productLabel, readiness });

  return (
    <ReviewGateView
      title={title}
      body={body}
      variant="warning"
      primaryLabel={CONFIGURE_PROVIDER_LABEL}
      onPrimary={onGoToSettings}
      onBack={onBack}
      disabled={disabled}
    />
  );
}

export function ConfigurationErrorView({
  onRetry,
  onBack,
  disabled = false,
}: ConfigurationErrorViewProps) {
  return (
    <ReviewGateView
      title={CONFIGURATION_ERROR_COPY.title}
      body={CONFIGURATION_ERROR_COPY.body}
      variant="error"
      primaryLabel="Retry"
      onPrimary={onRetry}
      onBack={onBack}
      disabled={disabled}
    />
  );
}
