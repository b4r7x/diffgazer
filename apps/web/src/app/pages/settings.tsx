import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useScope, useKey } from '@/hooks/keyboard';

type Tab = 'providers' | 'diagnostics';
type ModelPreset = 'fast' | 'balanced' | 'best';
type ProviderStatus = 'configured' | 'needs-key' | 'local';

interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
}

const PROVIDERS: Provider[] = [
  { id: 'gemini', name: 'Gemini', status: 'configured' },
  { id: 'openai', name: 'OpenAI', status: 'needs-key' },
  { id: 'anthropic', name: 'Anthropic', status: 'needs-key' },
  { id: 'openai-compatible', name: 'OpenAI-compatible', status: 'local' },
];

const PRESET_DESCRIPTIONS: Record<string, Record<ModelPreset, { model: string; description: string }>> = {
  gemini: {
    fast: { model: 'Gemini 1.5 Flash', description: 'Optimized for speed. Best for quick checks and simple tasks.' },
    balanced: { model: 'Gemini 1.5 Flash', description: 'Good for general code review, quick fixes, and standard refactoring tasks.' },
    best: { model: 'Gemini 1.5 Pro', description: 'Maximum quality. Best for complex analysis and detailed reviews.' },
  },
  openai: {
    fast: { model: 'GPT-4o-mini', description: 'Optimized for speed. Best for quick checks and simple tasks.' },
    balanced: { model: 'GPT-4o', description: 'Good for general code review, quick fixes, and standard refactoring tasks.' },
    best: { model: 'GPT-4o', description: 'Maximum quality. Best for complex analysis and detailed reviews.' },
  },
  anthropic: {
    fast: { model: 'Claude 3.5 Haiku', description: 'Optimized for speed. Best for quick checks and simple tasks.' },
    balanced: { model: 'Claude 3.5 Sonnet', description: 'Good for general code review, quick fixes, and standard refactoring tasks.' },
    best: { model: 'Claude 3 Opus', description: 'Maximum quality. Best for complex analysis and detailed reviews.' },
  },
  'openai-compatible': {
    fast: { model: 'Local Model', description: 'Use your locally configured model for fast inference.' },
    balanced: { model: 'Local Model', description: 'Use your locally configured model with default settings.' },
    best: { model: 'Local Model', description: 'Use your locally configured model with quality settings.' },
  },
};

const DIAGNOSTICS = {
  version: 'v2.4.0-nightly',
  nodeVersion: 'v20.5.1',
  tty: true,
  terminalSize: '120x40',
  colorSupport: '24-bit',
  unicodeSupport: 'Full Support',
  memoryRss: '42MB',
  memoryHeap: '28MB',
  paths: {
    config: '~/.config/stargazer',
    data: '~/.local/share/stargazer/runs',
    cache: '~/.cache/stargazer/v1',
  },
};

function getStatusBadge(status: ProviderStatus): ReactNode {
  switch (status) {
    case 'configured':
      return <span className="text-xs font-medium text-[--tui-green]">[configured]</span>;
    case 'needs-key':
      return <span className="text-xs text-[--tui-yellow]">[needs key]</span>;
    case 'local':
      return <span className="text-xs text-gray-600">[ local/other ]</span>;
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('providers');
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<ModelPreset>('balanced');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useScope('settings');
  useKey('Escape', () => navigate({ to: '/' }));

  const selectedProvider = PROVIDERS[selectedProviderIndex];
  const providerId = selectedProvider?.id ?? 'gemini';
  const presetInfo = PRESET_DESCRIPTIONS[providerId][selectedPreset];
  const presetLabel = selectedPreset.charAt(0).toUpperCase() + selectedPreset.slice(1);

  const footerShortcuts = activeTab === 'providers'
    ? [
        { key: 'Up/Down', label: 'Select' },
        { key: 'Enter', label: 'Save' },
        { key: 'Esc', label: 'Cancel' },
        { key: 'a', label: 'Advanced' },
      ]
    : [
        { key: 'Enter', label: 'Activate' },
        { key: 'Esc', label: 'Back' },
      ];

  const rightShortcuts = activeTab === 'providers' && selectedProvider
    ? [{ key: 'PROV:', label: `${selectedProvider.name} - MOD: ${presetLabel}` }]
    : [];

  return (
    <div className="tui-base h-screen flex flex-col overflow-hidden">
      <Header
        providerName={selectedProvider?.name}
        providerStatus={selectedProvider?.status === 'configured' ? 'active' : 'idle'}
        subtitle={activeTab === 'providers' ? 'AI Provider Configuration' : 'System Diagnostics'}
      />

      <div className="flex border-b border-[--tui-border] px-4">
        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={cn(
            'px-4 py-2 text-sm transition-colors',
            activeTab === 'providers'
              ? 'tui-tab-active'
              : 'tui-tab-inactive'
          )}
        >
          Providers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('diagnostics')}
          className={cn(
            'px-4 py-2 text-sm transition-colors',
            activeTab === 'diagnostics'
              ? 'tui-tab-active'
              : 'tui-tab-inactive'
          )}
        >
          Diagnostics
        </button>
      </div>

      {activeTab === 'providers' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 flex flex-col border-r border-[--tui-border]">
            <div className="p-3 border-b border-[--tui-border] bg-[--tui-selection]/30">
              <h2 className="text-sm font-bold text-[--tui-fg] uppercase tracking-wide">Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {PROVIDERS.map((provider, index) => {
                const isSelected = index === selectedProviderIndex;
                return (
                  <button
                    type="button"
                    key={provider.id}
                    onClick={() => setSelectedProviderIndex(index)}
                    className={cn(
                      'w-full px-3 py-2 flex justify-between items-center cursor-pointer transition-colors text-left',
                      isSelected && 'bg-[--tui-blue] text-black',
                      !isSelected && 'text-gray-400 hover:bg-[--tui-selection] hover:text-[--tui-fg] group'
                    )}
                  >
                    <span className={cn('flex items-center', isSelected && 'font-bold')}>
                      <span className={cn('mr-2', isSelected ? 'text-black' : 'opacity-0 group-hover:opacity-100')}>
                        {isSelected ? String.fromCharCode(9679) : String.fromCharCode(9675)}
                      </span>
                      {provider.name}
                    </span>
                    {getStatusBadge(provider.status)}
                  </button>
                );
              })}
            </div>
            <div className="p-3 text-xs text-gray-600 border-t border-[--tui-border]">
              Select a provider to configure API keys and model defaults.
            </div>
          </div>

          <div className="w-2/3 flex flex-col bg-[#0f131a]">
            <div className="p-3 border-b border-[--tui-border] bg-[--tui-selection]/30 flex justify-between">
              <h2 className="text-sm font-bold text-[--tui-fg] uppercase tracking-wide">
                {selectedProvider?.name} Configuration
              </h2>
              {selectedProvider?.status === 'configured' && (
                <span className="text-xs text-[--tui-green] font-mono">Active</span>
              )}
            </div>

            <div className="p-8 flex-1 flex flex-col gap-8">
              <div>
                <label className="block text-[--tui-violet] font-bold mb-4 uppercase text-xs tracking-wider">
                  Model Preset
                </label>
                <div className="flex border border-[--tui-border] w-max">
                  <Button
                    variant={selectedPreset === 'fast' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedPreset('fast')}
                    className={cn(
                      'border-r border-[--tui-border] rounded-none',
                      selectedPreset !== 'fast' && 'text-gray-400'
                    )}
                  >
                    [ Fast ]
                  </Button>
                  <Button
                    variant={selectedPreset === 'balanced' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedPreset('balanced')}
                    className={cn(
                      'border-r border-[--tui-border] rounded-none',
                      selectedPreset !== 'balanced' && 'text-gray-400'
                    )}
                  >
                    [ Balanced ]
                  </Button>
                  <Button
                    variant={selectedPreset === 'best' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedPreset('best')}
                    className={cn(
                      'rounded-none',
                      selectedPreset !== 'best' && 'text-gray-400'
                    )}
                  >
                    [ Best ]
                  </Button>
                </div>
                <p className="mt-3 text-xs text-gray-500 max-w-md">
                  <span className="text-[--tui-blue] font-bold">
                    {presetLabel}:
                  </span>{' '}
                  Uses <span className="text-[--tui-fg]">{presetInfo.model}</span>. {presetInfo.description}
                </p>
              </div>

              <div className="h-px bg-[--tui-border] w-full" />

              {showAdvanced && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[--tui-violet] font-bold mb-2 uppercase text-xs tracking-wider">
                      Model ID
                    </label>
                    <input
                      type="text"
                      className="bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:border-[--tui-blue]"
                      placeholder={presetInfo.model}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-[--tui-violet] font-bold mb-2 uppercase text-xs tracking-wider">
                        Temperature
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        className="bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] px-3 py-2 text-sm w-24 focus:outline-none focus:border-[--tui-blue]"
                        defaultValue="0.7"
                      />
                    </div>
                    <div>
                      <label className="block text-[--tui-violet] font-bold mb-2 uppercase text-xs tracking-wider">
                        Timeout (ms)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        min="1000"
                        className="bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] px-3 py-2 text-sm w-32 focus:outline-none focus:border-[--tui-blue]"
                        defaultValue="30000"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-auto mb-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="group cursor-pointer flex items-center gap-2 text-gray-500 hover:text-[--tui-fg] transition-colors"
                >
                  <span className="text-[--tui-yellow] font-bold">[a]</span>
                  <span className="border-b border-dashed border-gray-700 group-hover:border-[--tui-fg]">
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Settings (Model ID, Temp, Timeout)
                  </span>
                  <span className="text-sm">{showAdvanced ? '\u25B2' : '\u25BC'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="flex flex-1 overflow-hidden px-4 justify-center items-center">
          <div className="w-full max-w-2xl flex flex-col border border-[--tui-border] bg-[#161b22]">
            <div className="bg-[--tui-selection] border-b border-[--tui-border] px-4 py-2 flex justify-between items-center">
              <span className="font-bold text-[--tui-fg]">System Diagnostics</span>
              <span className="text-xs text-gray-500">{DIAGNOSTICS.version}</span>
            </div>

            <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Version Info</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[--tui-blue]">Stargazer {DIAGNOSTICS.version}</span>
                    <span className="text-[--tui-border]">|</span>
                    <span className="text-[--tui-green]">Node {DIAGNOSTICS.nodeVersion}</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Terminal Environment</span>
                  <div className="flex items-center gap-2">
                    <span>TTY <span className="text-[--tui-green]">[{DIAGNOSTICS.tty ? 'Yes' : 'No'}]</span></span>
                    <span className="text-[--tui-border]">|</span>
                    <span>{DIAGNOSTICS.terminalSize}</span>
                    <span className="text-[--tui-border]">|</span>
                    <span>Color <span className="text-[--tui-violet]">[{DIAGNOSTICS.colorSupport}]</span></span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Unicode Support</span>
                  <div className="text-white flex items-center gap-2">
                    <span>[{DIAGNOSTICS.unicodeSupport}]</span>
                    <span className="text-xs text-[--tui-yellow]">{'\u2714'} {'\u2716'} {'\u25B2'} {'\u25CF'}</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Memory Usage</span>
                  <div className="text-white">
                    RSS: {DIAGNOSTICS.memoryRss} / Heap: {DIAGNOSTICS.memoryHeap}
                  </div>
                </div>
              </div>

              <div className="border-t border-[--tui-border] border-dashed" />

              <div className="space-y-3">
                <h3 className="text-[--tui-violet] font-bold text-xs uppercase tracking-wider">Storage Paths</h3>
                <div className="grid grid-cols-[80px_1fr] gap-2 text-sm font-mono">
                  <span className="text-gray-500 text-right">Config:</span>
                  <span className="text-[--tui-fg]">{DIAGNOSTICS.paths.config}</span>
                  <span className="text-gray-500 text-right">Data:</span>
                  <span className="text-[--tui-fg]">{DIAGNOSTICS.paths.data}</span>
                  <span className="text-gray-500 text-right">Cache:</span>
                  <span className="text-[--tui-fg]">{DIAGNOSTICS.paths.cache}</span>
                </div>
              </div>

              <div className="border-t border-[--tui-border] border-dashed" />

              <div className="flex gap-4 pt-2">
                <Button variant="secondary" size="sm">
                  [ Print Paths ]
                </Button>
                <Button variant="secondary" size="sm">
                  [ Export Debug Report ]
                </Button>
                <Button variant="destructive" size="sm" className="ml-auto">
                  [ Reset UI Settings ]
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer shortcuts={footerShortcuts} rightShortcuts={rightShortcuts} />
    </div>
  );
}
