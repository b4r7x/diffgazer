import { usePageFooter } from "@diffgazer/core/footer";
import { getApiKeyMissingCopy } from "@diffgazer/core/review";
import type { AIProvider, SetupStatus } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { useRef } from "react";

export interface ApiKeyMissingViewProps {
  activeProvider?: AIProvider;
  onNavigateSettings: () => void;
  onBack: () => void;
  missing: Readonly<SetupStatus["missing"]>;
  primaryDisabled?: boolean;
}

interface ReviewSetupGateViewProps {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  onBack: () => void;
  isError?: boolean;
  primaryDisabled?: boolean;
}

function ReviewSetupGateView({
  title,
  body,
  primaryLabel,
  onPrimary,
  onBack,
  isError = false,
  primaryDisabled = false,
}: ReviewSetupGateViewProps) {
  useScope("review-setup-gate");
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const actions = [onPrimary, onBack];

  const footer = useActionRowNavigation<readonly unknown[]>({
    enabled: true,
    actionCount: actions.length,
    disabledActions: [primaryDisabled, false],
    defaultZone: "actions",
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => actions[index]?.(),
  });

  useKey("Escape", onBack);

  const focusedLabel = footer.focusedIndex === 0 ? primaryLabel : "Back to Home";

  const footerShortcuts: Shortcut[] = [
    { key: "←/→", label: "Move Action" },
    { key: "Enter/Space", label: focusedLabel, disabled: footer.isFocusedActionDisabled },
  ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [BACK_SHORTCUT],
  });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        ref={focusFallbackRef}
        tabIndex={-1}
        className="text-center max-w-md p-6 focus:outline-none"
      >
        <div
          role={isError ? "alert" : undefined}
          className={`${isError ? "text-error-text" : "text-warning-text"} text-lg font-bold mb-4`}
        >
          {title}
        </div>
        <p className="text-muted-foreground font-mono text-sm mb-6">{body}</p>
        <div className="flex gap-4 justify-center">
          <Button
            {...footer.getActionProps(0)}
            variant="outline"
            bracket
            disabled={primaryDisabled}
            highlighted={footer.inActions && footer.focusedIndex === 0}
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="secondary"
            bracket
            highlighted={footer.inActions && footer.focusedIndex === 1}
            onClick={onBack}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ApiKeyMissingView({
  activeProvider,
  onNavigateSettings,
  onBack,
  missing,
  primaryDisabled,
}: ApiKeyMissingViewProps) {
  const copy = getApiKeyMissingCopy({ provider: activeProvider, missing });

  return (
    <ReviewSetupGateView
      title={copy.title}
      body={copy.body}
      primaryLabel="Configure Provider"
      onPrimary={onNavigateSettings}
      onBack={onBack}
      primaryDisabled={primaryDisabled}
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
    <ReviewSetupGateView
      title="Configuration Unavailable"
      body="Diffgazer could not load the current configuration. Retry the request or return home."
      primaryLabel="Retry"
      onPrimary={onRetry}
      onBack={onBack}
      primaryDisabled={primaryDisabled}
      isError
    />
  );
}
