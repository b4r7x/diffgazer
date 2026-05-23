import { useRef } from 'react';
import type { AIProvider } from '@diffgazer/core/schemas/config';
import { useScope, useKey, useActionRowNavigation } from '@diffgazer/keys';
import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Button } from '@diffgazer/ui/components/button';

export interface ApiKeyMissingViewProps {
  activeProvider?: AIProvider;
  onNavigateSettings: () => void;
  onBack: () => void;
  missingModel?: boolean;
}

export function ApiKeyMissingView({
  activeProvider,
  onNavigateSettings,
  onBack,
  missingModel = false,
}: ApiKeyMissingViewProps) {
  useScope('api-key-missing');

  const focusFallbackRef = useRef<HTMLDivElement>(null);

  const actions = [onNavigateSettings, onBack];

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    defaultZone: "actions",
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => actions[index]?.(),
  });

  useKey('Escape', onBack);

  const focusedLabel = footer.focusedIndex === 0 ? 'Configure Provider' : 'Back to Home';

  const footerShortcuts: Shortcut[] = [
    { key: '←/→', label: 'Move Action' },
    { key: 'Enter/Space', label: focusedLabel },
  ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: 'Esc', label: 'Back' }],
  });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        ref={focusFallbackRef}
        tabIndex={-1}
        className="text-center max-w-md p-6 focus:outline-none"
      >
        <div className="text-tui-yellow text-lg font-bold mb-4">
          {missingModel ? "Model Required" : "API Key Required"}
        </div>
        <p className="text-tui-muted font-mono text-sm mb-6">
          {missingModel
            ? `No model selected${activeProvider ? ` for ${activeProvider}` : ''}.`
            : `No API key configured${activeProvider ? ` for ${activeProvider}` : ''}.`}
          {" "}Please configure your provider settings to continue.
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            {...footer.getActionProps(0)}
            variant="outline"
            bracket
            highlighted={footer.inActions && footer.focusedIndex === 0}
            onClick={onNavigateSettings}
          >
            Configure Provider
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
