import { getNoChangesCopy } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { ReviewGateView } from "./api-key-missing-view";

export interface NoChangesViewProps {
  mode: ReviewMode;
  onSwitchMode: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export function NoChangesView({
  mode,
  onSwitchMode,
  onBack,
  disabled = false,
}: NoChangesViewProps) {
  const { title, message, switchLabel } = getNoChangesCopy(mode);
  return (
    <ReviewGateView
      title={title}
      body={message}
      variant="warning"
      primaryLabel={switchLabel}
      onPrimary={onSwitchMode}
      onBack={onBack}
      disabled={disabled}
    />
  );
}
