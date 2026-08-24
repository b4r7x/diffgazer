import {
  isProviderRecoveryError,
  type ReviewStreamErrorGuidance,
  sanitizePresentationText,
} from "@diffgazer/core/review";
import { FailureView } from "@/components/shared/failure-view";

const REVIEW_TERMINAL_ERROR_SCOPE = "review-terminal-error";

/**
 * A run that died with nothing saved to open and no transport to reconnect: the
 * live screen behind it has stopped, so the failure takes the whole frame. The
 * web twin of the TUI's terminal error view — the failure's own sentence, the
 * guidance under it, and the providers CTA when the guidance names one.
 */
export function ReviewTerminalErrorView({
  error,
  guidance,
  onBack,
  onConfigureProvider,
  actionsDisabled,
}: {
  error: string;
  guidance: ReviewStreamErrorGuidance;
  onBack: () => void;
  onConfigureProvider: () => void;
  actionsDisabled?: boolean;
}) {
  const back = { label: "Back to Home", onAction: onBack };
  // The failure's own words lead in the identity slot — data the user may need
  // to quote — and the guidance reads as the prose under it.
  const shared = {
    title: guidance.title,
    meta: sanitizePresentationText(error),
    message: guidance.guidance,
    scope: REVIEW_TERMINAL_ERROR_SCOPE,
  };

  if (!isProviderRecoveryError(guidance.kind)) {
    return <FailureView {...shared} primary={back} />;
  }

  return (
    <FailureView
      {...shared}
      primary={{
        label: guidance.ctaLabel,
        onAction: onConfigureProvider,
        disabled: actionsDisabled,
      }}
      secondary={back}
    />
  );
}
