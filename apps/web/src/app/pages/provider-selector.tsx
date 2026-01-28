'use client';

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useKey } from '@/hooks/keyboard';
import { useRouteState } from '@/hooks/use-route-state';
import { useFooter } from '@/components/layout';
import {
  ProviderList,
  ProviderDetails,
  ApiKeyDialog,
  ModelSelectDialog,
  useProviders,
  type ProviderFilter,
} from '@/features/providers';
import { PROVIDER_ENV_VARS, PROVIDER_CAPABILITIES, type AIProvider } from '@repo/schemas';

const FOOTER_SHORTCUTS = [
  { key: '↑/↓', label: 'Navigate' },
  { key: '/', label: 'Search' },
  { key: 'Tab', label: 'Switch Focus' },
  { key: 't', label: 'Test' },
  { key: 'k', label: 'Set Key' },
];

export function ProviderSelectorPage() {
  const navigate = useNavigate();
  const { setShortcuts, setRightShortcuts } = useFooter();

  // Route state
  const [selectedIndex, setSelectedIndex] = useRouteState('providerIndex', 0);
  const [filter, setFilter] = useState<ProviderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);

  // Panel focus
  const [activePanel, setActivePanel] = useState<'list' | 'details'>('list');

  // Data
  const {
    providers,
    activeProvider,
    isLoading,
    saveApiKey,
    removeApiKey,
    selectProvider,
    refetch,
  } = useProviders();

  // Filter providers
  const filteredProviders = useMemo(() => {
    let result = providers;

    // Apply filter
    if (filter === 'configured') {
      result = result.filter((p) => p.hasApiKey);
    } else if (filter === 'needs-key') {
      result = result.filter((p) => !p.hasApiKey);
    } else if (filter === 'free') {
      result = result.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === 'free' || PROVIDER_CAPABILITIES[p.id]?.tier === 'mixed');
    } else if (filter === 'paid') {
      result = result.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === 'paid');
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
    }

    return result;
  }, [providers, filter, searchQuery]);

  // Selected provider
  const selectedProvider = filteredProviders[selectedIndex] ?? null;

  // Keyboard shortcuts
  useKey('Tab', () => setActivePanel((p) => (p === 'list' ? 'details' : 'list')));
  useKey('Escape', () => navigate({ to: '/settings' }), { enabled: !apiKeyDialogOpen && !modelDialogOpen });
  useKey('k', () => setApiKeyDialogOpen(true), { enabled: activePanel === 'details' && !apiKeyDialogOpen && !modelDialogOpen });
  useKey('m', () => setModelDialogOpen(true), { enabled: activePanel === 'details' && !apiKeyDialogOpen && !modelDialogOpen });

  // Footer
  useEffect(() => {
    setShortcuts(FOOTER_SHORTCUTS);
    const statusText = selectedProvider?.isActive ? 'ACTIVE' : selectedProvider?.hasApiKey ? 'READY' : 'NEEDS KEY';
    setRightShortcuts([
      { key: 'PROV:', label: `${selectedProvider?.name ?? 'None'} • STATUS: ${statusText}` },
    ]);
  }, [selectedProvider, setShortcuts, setRightShortcuts]);

  // Handlers
  const handleSaveApiKey = async (method: 'paste' | 'env', value: string) => {
    if (!selectedProvider) return;
    await saveApiKey(selectedProvider.id, value, method);
    await refetch();
    setApiKeyDialogOpen(false);
  };

  const handleRemoveKey = async () => {
    if (!selectedProvider) return;
    await removeApiKey(selectedProvider.id);
    await refetch();
    setApiKeyDialogOpen(false);
  };

  const handleSelectProvider = async () => {
    if (!selectedProvider) return;
    await selectProvider(selectedProvider.id, selectedProvider.model);
    await refetch();
  };

  const handleSelectModel = async (modelId: string) => {
    if (!selectedProvider) return;
    await selectProvider(selectedProvider.id, modelId);
    await refetch();
    setModelDialogOpen(false);
  };

  const handleActivate = (item: { id: string }) => {
    const provider = filteredProviders.find((p) => p.id === item.id);
    if (provider) {
      setActivePanel('details');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-gray-500">Loading providers...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-2/5 flex flex-col border-r border-tui-border">
        <ProviderList
          providers={filteredProviders.map((p) => ({
            ...p,
            displayStatus: p.isActive ? 'active' : p.hasApiKey ? 'configured' : 'needs-key',
          }))}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onActivate={handleActivate}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          keyboardEnabled={activePanel === 'list' && !apiKeyDialogOpen && !modelDialogOpen}
        />
      </div>
      <div className="w-3/5 flex flex-col bg-[#0b0e14]">
        <ProviderDetails
          provider={selectedProvider}
          onSetApiKey={() => setApiKeyDialogOpen(true)}
          onSelectModel={() => setModelDialogOpen(true)}
          onRemoveKey={handleRemoveKey}
          onSelectProvider={handleSelectProvider}
        />
      </div>

      {selectedProvider && (
        <>
          <ApiKeyDialog
            open={apiKeyDialogOpen}
            onOpenChange={setApiKeyDialogOpen}
            providerName={selectedProvider.name}
            envVarName={PROVIDER_ENV_VARS[selectedProvider.id]}
            hasExistingKey={selectedProvider.hasApiKey}
            onSubmit={handleSaveApiKey}
            onRemoveKey={handleRemoveKey}
          />
          <ModelSelectDialog
            open={modelDialogOpen}
            onOpenChange={setModelDialogOpen}
            provider={selectedProvider.id}
            currentModel={selectedProvider.model}
            onSelect={handleSelectModel}
          />
        </>
      )}
    </div>
  );
}
