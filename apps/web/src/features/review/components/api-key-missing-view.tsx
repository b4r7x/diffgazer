import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  CREDENTIAL_ERROR_COPY,
  describeTerminalOutcome,
  describeUsageAvailability,
  getConfigurationNotReadyCopy,
  isCredentialSetupError,
} from "@diffgazer/core/review";
import type { Readiness } from "@diffgazer/core/schemas/config";
import type { TerminalOutcome, UsageAvailability } from "@diffgazer/core/schemas/review";
import {
  isUnauthorizedError,
  UNAUTHORIZED_ERROR_COPY,
} from "@/components/shared/configuration-status";
import { FailureView } from "@/components/shared/failure-view";

export interface ApiKeyMissingViewProps {
  readiness: Readiness;
  productLabel?: string;
  /** The configuration's identity (provider, model), kept visible through the gate. */
  meta?: string;
  primaryLabel: string;
  onNavigateSettings: () => void;
  onBack: () => void;
  primaryDisabled?: boolean;
}

const REVIEW_SETUP_GATE_SCOPE = "review-setup-gate";

export function ApiKeyMissingView({
  readiness,
  productLabel,
  meta,
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
      meta={meta}
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

/**
 * Configuration load failure: Retry leads because the failure is transient by
 * default, but Configure Provider keeps a real way out when retrying cannot
 * succeed — missing credential files leave nothing for Retry to reload. A 401
 * is the exception: provider setup cannot fix a session-token mismatch, so
 * that branch names the mismatch and offers Retry alone. A credential-caused
 * failure keeps the same actions but reads as a warning-toned reconnect state.
 */
export function ConfigurationErrorView({
  error,
  onRetry,
  onConfigureProvider,
  onBack,
  actionsDisabled,
}: {
  error?: Error;
  onRetry: () => void;
  onConfigureProvider: () => void;
  onBack: () => void;
  actionsDisabled?: boolean;
}) {
  if (error && isUnauthorizedError(error)) {
    return (
      <FailureView
        title={UNAUTHORIZED_ERROR_COPY.title}
        message={UNAUTHORIZED_ERROR_COPY.body}
        scope={REVIEW_SETUP_GATE_SCOPE}
        primary={{ label: "Retry", onAction: onRetry, disabled: actionsDisabled }}
        secondary={{ label: "Back to Home", onAction: onBack }}
      />
    );
  }

  const isCredential = error !== undefined && isCredentialSetupError(error);
  const copy = isCredential ? CREDENTIAL_ERROR_COPY : CONFIGURATION_ERROR_COPY;

  return (
    <FailureView
      title={copy.title}
      message={copy.body}
      tone={isCredential ? "warning" : "error"}
      scope={REVIEW_SETUP_GATE_SCOPE}
      primary={{ label: "Retry", onAction: onRetry, disabled: actionsDisabled }}
      recovery={{
        label: CONFIGURE_PROVIDER_LABEL,
        onAction: onConfigureProvider,
        disabled: actionsDisabled,
      }}
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
