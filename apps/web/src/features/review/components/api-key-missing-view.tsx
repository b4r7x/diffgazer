import type { AIProvider } from '@stargazer/schemas/config';
import { useScope, useKey } from '@/hooks/keyboard';
import { usePageFooter } from '@/hooks/use-page-footer';

const FOOTER_SHORTCUTS = [{ key: 'Enter', label: 'Setup Provider' }];
const FOOTER_RIGHT_SHORTCUTS = [{ key: 'Esc', label: 'Back' }];

export interface ApiKeyMissingViewProps {
  activeProvider?: AIProvider;
  onNavigateSettings: () => void;
  onBack: () => void;
}

export function ApiKeyMissingView({
  activeProvider,
  onNavigateSettings,
  onBack,
}: ApiKeyMissingViewProps) {
  useScope('api-key-missing');

  useKey('Enter', onNavigateSettings);
  useKey('Escape', onBack);

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS, rightShortcuts: FOOTER_RIGHT_SHORTCUTS });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-md p-6">
        <div className="text-tui-yellow text-lg font-bold mb-4">
          API Key Required
        </div>
        <p className="text-gray-400 font-mono text-sm mb-6">
          No API key configured{activeProvider ? ` for ${activeProvider}` : ''}.
          Please configure your provider settings to continue.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={onNavigateSettings}
            className="px-4 py-2 border border-tui-blue text-sm font-mono hover:bg-tui-blue/20"
          >
            [ Configure Provider ]
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-tui-border text-sm font-mono hover:bg-tui-border/20"
          >
            [ Back to Home ]
          </button>
        </div>
      </div>
    </div>
  );
}
