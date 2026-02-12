import type { AIProvider } from '@diffgazer/schemas/config';
import { useScope, useKey } from 'keyscope';
import { usePageFooter } from '@/hooks/use-page-footer';
import { Button } from '@diffgazer/ui';

const FOOTER_SHORTCUTS = [{ key: 'Enter', label: 'Setup Provider' }];
const FOOTER_RIGHT_SHORTCUTS = [{ key: 'Esc', label: 'Back' }];

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

  useKey('Enter', onNavigateSettings);
  useKey('Escape', onBack);

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS, rightShortcuts: FOOTER_RIGHT_SHORTCUTS });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-md p-6">
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
            variant="outline"
            bracket
            className="border-tui-blue hover:bg-tui-blue/20"
            onClick={onNavigateSettings}
          >
            Configure Provider
          </Button>
          <Button
            variant="secondary"
            bracket
            onClick={onBack}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
