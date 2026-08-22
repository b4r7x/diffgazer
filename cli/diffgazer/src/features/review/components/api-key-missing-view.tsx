import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  CREDENTIAL_ERROR_COPY,
  describeTerminalOutcome,
  describeUsageAvailability,
  ENTER_API_KEY_LABEL,
  type FailedTerminalOutcome,
  getConfigurationNotReadyCopy,
  isCredentialReconnectReadiness,
  isCredentialSetupError,
} from "@diffgazer/core/review";
import type { Readiness } from "@diffgazer/core/schemas/config";
import type { UsageAvailability } from "@diffgazer/core/schemas/review";
import { ReviewGateView } from "./gate-view";

export interface ApiKeyMissingViewProps {
  productLabel?: string;
  /** The configuration's identity (provider, model), kept visible through the gate. */
  meta?: string;
  readiness: Readiness;
  onGoToSettings: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export interface ConfigurationErrorViewProps {
  error?: unknown;
  onRetry: () => void;
  onGoToSettings: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export function ApiKeyMissingView({
  productLabel,
  meta,
  readiness,
  onGoToSettings,
  onBack,
  disabled = false,
}: ApiKeyMissingViewProps) {
  const { title, body } = getConfigurationNotReadyCopy({ productLabel, readiness });

  return (
    <ReviewGateView
      title={title}
      body={body}
      meta={meta}
      variant="warning"
      primaryLabel={
        isCredentialReconnectReadiness(readiness) ? ENTER_API_KEY_LABEL : CONFIGURE_PROVIDER_LABEL
      }
      onPrimary={onGoToSettings}
      onBack={onBack}
      disabled={disabled}
    />
  );
}

/**
 * Retry-first load-failure gate. A credential-caused failure keeps the same
 * actions but reads as a warning-toned reconnect state instead of an error.
 */
export function ConfigurationErrorView({
  error,
  onRetry,
  onGoToSettings,
  onBack,
  disabled = false,
}: ConfigurationErrorViewProps) {
  const isCredential = isCredentialSetupError(error);
  const copy = isCredential ? CREDENTIAL_ERROR_COPY : CONFIGURATION_ERROR_COPY;

  return (
    <ReviewGateView
      title={copy.title}
      body={copy.body}
      variant={isCredential ? "warning" : "error"}
      primaryLabel="Retry"
      onPrimary={onRetry}
      onGoToSettings={onGoToSettings}
      onBack={onBack}
      disabled={disabled}
    />
  );
}

export function ReviewTerminalReceiptView({
  outcome,
  usageAvailability,
  onBack,
}: {
  outcome: FailedTerminalOutcome;
  usageAvailability?: UsageAvailability;
  onBack: () => void;
}) {
  const { title, message } = describeTerminalOutcome(outcome);
  const usage = usageAvailability ? describeUsageAvailability(usageAvailability) : null;
  const body = usage ? `${message} ${usage.label}: ${usage.detail}` : message;

  return (
    <ReviewGateView
      title={title}
      body={body}
      variant="error"
      primaryLabel="Back"
      onPrimary={onBack}
      onBack={onBack}
      showBackButton={false}
    />
  );
}
