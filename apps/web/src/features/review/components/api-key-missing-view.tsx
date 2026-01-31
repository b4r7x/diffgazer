import type { AIProvider } from '@repo/schemas/config';
import { useScope, useKey } from '@/hooks/keyboard';
import { usePageFooter } from '@/hooks/use-page-footer';

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

  usePageFooter({
    shortcuts: [{ key: 'Enter', label: 'Setup Provider' }],
    rightShortcuts: [{ key: 'Esc', label: 'Back' }],
  });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-md p-6">
        <div className="text-tui-yellow text-lg font-bold mb-4">
          API Key Required
        </div>
        <div className="text-gray-400 font-mono text-sm mb-6">
          {activeProvider
            ? `No API key configured for ${activeProvider}. Please configure your provider settings to continue.`
            : 'No API key configured. Please configure your provider settings to continue.'}
        </div>
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
