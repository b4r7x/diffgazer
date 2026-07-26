import {
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  getApiKeyMissingCopy,
} from "@diffgazer/core/review";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import { ReviewGateView } from "./review-gate-view";

export interface ApiKeyMissingViewProps {
  provider?: string;
  missing: Readonly<SetupStatus["missing"]>;
  onGoToSettings: () => void;
  onBack: () => void;
}

export interface ConfigurationErrorViewProps {
  onRetry: () => void;
  onBack: () => void;
}

export function ApiKeyMissingView({
  provider,
  missing,
  onGoToSettings,
  onBack,
}: ApiKeyMissingViewProps) {
  const { title, body } = getApiKeyMissingCopy({ provider, missing });

  return (
    <ReviewGateView
      title={title}
      body={body}
      variant="warning"
      primaryLabel={CONFIGURE_PROVIDER_LABEL}
      onPrimary={onGoToSettings}
      onBack={onBack}
    />
  );
}

export function ConfigurationErrorView({ onRetry, onBack }: ConfigurationErrorViewProps) {
  return (
    <ReviewGateView
      title={CONFIGURATION_ERROR_COPY.title}
      body={CONFIGURATION_ERROR_COPY.body}
      variant="error"
      primaryLabel="Retry"
      onPrimary={onRetry}
      onBack={onBack}
    />
  );
}
