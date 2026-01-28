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
import { PROVIDER_ENV_VARS, PROVIDER_CAPABILITIES } from '@repo/schemas';

const FOOTER_SHORTCUTS = [
  { key: '↑/↓', label: 'Navigate' },
  { key: '←/→', label: 'Switch Panel' },
  { key: '/', label: 'Search' },
  { key: 'Enter', label: 'Activate' },
  { key: 'Esc', label: 'Back' },
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Panel focus
  const [focusZone, setFocusZone] = useState<'list' | 'buttons'>('list');
  const [buttonIndex, setButtonIndex] = useState(0);

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

  // Memoize providers with display status to avoid re-creating objects
  const providersWithStatus = useMemo(
    () => filteredProviders.map((p) => ({
      ...p,
      displayStatus: p.isActive ? 'active' as const : p.hasApiKey ? 'configured' as const : 'needs-key' as const,
    })),
    [filteredProviders]
  );

  // Keyboard shortcuts
  const dialogOpen = apiKeyDialogOpen || modelDialogOpen;
  const inButtons = focusZone === 'buttons';
  const inList = focusZone === 'list';
  const canRemoveKey = selectedProvider?.hasApiKey ?? false;

  // Helper to skip disabled buttons during navigation
  const getNextButtonIndex = (current: number, direction: 1 | -1) => {
    const enabled = [true, true, canRemoveKey, true];
    let next = current;
    for (let i = 0; i < 4; i++) {
      next = (next + direction + 4) % 4;
      if (enabled[next]) return next;
    }
    return current;
  };

  // Tab toggles zones (only if provider selected)
  useKey('Tab', () => {
    if (focusZone === 'list' && selectedProvider) {
      setFocusZone('buttons');
      setButtonIndex(0);
    } else {
      setFocusZone('list');
    }
  });

  // ArrowRight: list → buttons (only if provider selected)
  useKey('ArrowRight', () => { setFocusZone('buttons'); setButtonIndex(0); },
    { enabled: !dialogOpen && inList && !!selectedProvider });

  // ArrowLeft: buttons → list
  useKey('ArrowLeft', () => setFocusZone('list'),
    { enabled: !dialogOpen && inButtons });

  // ArrowUp/Down: navigate buttons (skip disabled)
  useKey('ArrowUp', () => setButtonIndex((i) => getNextButtonIndex(i, -1)),
    { enabled: !dialogOpen && inButtons });
  useKey('ArrowDown', () => setButtonIndex((i) => getNextButtonIndex(i, 1)),
    { enabled: !dialogOpen && inButtons });

  // Enter/Space: activate focused button
  useKey('Enter', () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons });
  useKey(' ', () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons });

  // Escape to go back
  useKey('Escape', () => navigate({ to: '/settings' }), { enabled: !dialogOpen });

  // Reset focus to list when no provider selected
  useEffect(() => {
    if (!selectedProvider && focusZone === 'buttons') {
      setFocusZone('list');
    }
  }, [selectedProvider, focusZone]);

  // Clamp index when filtered list shrinks
  useEffect(() => {
    if (selectedIndex >= filteredProviders.length && filteredProviders.length > 0) {
      setSelectedIndex(filteredProviders.length - 1);
    }
  }, [filteredProviders.length, selectedIndex, setSelectedIndex]);

  // Footer
  useEffect(() => {
    setShortcuts(FOOTER_SHORTCUTS);
    const statusText = selectedProvider?.isActive ? 'ACTIVE' : selectedProvider?.hasApiKey ? 'READY' : 'NEEDS KEY';
    setRightShortcuts([
      { key: 'PROV:', label: `${selectedProvider?.name ?? 'None'} • STATUS: ${statusText}` },
    ]);
  }, [selectedProvider, setShortcuts, setRightShortcuts]);

  // Handlers
  const handleButtonAction = (index: number) => {
    if (!selectedProvider) return;
    switch (index) {
      case 0: handleSelectProvider(); break;
      case 1: setApiKeyDialogOpen(true); break;
      case 2: if (selectedProvider.hasApiKey) handleRemoveKey(); break;
      case 3: setModelDialogOpen(true); break;
    }
  };

  const handleSaveApiKey = async (method: 'paste' | 'env', value: string) => {
    if (!selectedProvider || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await saveApiKey(selectedProvider.id, value, method);
      await refetch();
      setApiKeyDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!selectedProvider || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await removeApiKey(selectedProvider.id);
      await refetch();
      setApiKeyDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProvider = async () => {
    if (!selectedProvider || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await selectProvider(selectedProvider.id, selectedProvider.model);
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectModel = async (modelId: string) => {
    if (!selectedProvider || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await selectProvider(selectedProvider.id, modelId);
      await refetch();
      setModelDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = (_item: { id: string }) => {
    // Click on list item should NOT change focus zone
    // Selection already handled by onSelect={setSelectedIndex}
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
          providers={providersWithStatus}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onActivate={handleActivate}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          keyboardEnabled={focusZone === 'list' && !dialogOpen}
        />
      </div>
      <div className="w-3/5 flex flex-col bg-[#0b0e14]">
        <ProviderDetails
          provider={selectedProvider}
          onSetApiKey={() => setApiKeyDialogOpen(true)}
          onSelectModel={() => setModelDialogOpen(true)}
          onRemoveKey={handleRemoveKey}
          onSelectProvider={handleSelectProvider}
          focusedButtonIndex={focusZone === 'buttons' && selectedProvider ? buttonIndex : undefined}
          isFocused={focusZone === 'buttons' && !!selectedProvider}
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
