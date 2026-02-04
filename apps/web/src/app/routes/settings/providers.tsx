'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useKey } from '@/hooks/keyboard';
import { useScopedRouteState } from '@/hooks/use-scoped-route-state';
import { usePageFooter } from '@/hooks/use-page-footer';
import { useToast } from '@/components/ui';
import {
  ProviderList,
  ProviderDetails,
  ApiKeyDialog,
  ModelSelectDialog,
  type ProviderFilter,
  FILTER_VALUES,
} from '@/features/providers/components';
import { useProviders } from '@/features/providers/hooks';
import { PROVIDER_ENV_VARS, PROVIDER_CAPABILITIES } from '@stargazer/schemas';

const FOOTER_SHORTCUTS = [
  { key: '↑/↓', label: 'Navigate' },
  { key: '←/→', label: 'Switch Panel' },
  { key: '/', label: 'Search' },
  { key: 'Enter', label: 'Activate' },
  { key: 'Esc', label: 'Back' },
];

type FocusZone = 'input' | 'filters' | 'list' | 'buttons';

export function ProviderSettingsPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useScopedRouteState<string | null>('providerId', null);
  const [filter, setFilter] = useState<ProviderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [focusZone, setFocusZone] = useState<FocusZone>('list');
  const [filterIndex, setFilterIndex] = useState(0);
  const [buttonIndex, setButtonIndex] = useState(0);

  const {
    providers,
    isLoading,
    saveApiKey,
    removeApiKey,
    selectProvider,
    refetch,
  } = useProviders();
  const { showToast } = useToast();

  const filteredProviders = useMemo(() => {
    let result = providers;

    if (filter === 'configured') {
      result = result.filter((p) => p.hasApiKey);
    } else if (filter === 'needs-key') {
      result = result.filter((p) => !p.hasApiKey);
    } else if (filter === 'free') {
      result = result.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === 'free' || PROVIDER_CAPABILITIES[p.id]?.tier === 'mixed');
    } else if (filter === 'paid') {
      result = result.filter((p) => PROVIDER_CAPABILITIES[p.id]?.tier === 'paid');
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
    }

    return result;
  }, [providers, filter, searchQuery]);

  const providersWithStatus = useMemo(
    () => filteredProviders.map((p) => ({
      ...p,
      displayStatus: p.isActive ? 'active' as const : p.hasApiKey ? 'configured' as const : 'needs-key' as const,
      selectedModel: p.model,
    })),
    [filteredProviders]
  );

  const selectedProvider = selectedId
    ? providersWithStatus.find((p) => p.id === selectedId) ?? null
    : providersWithStatus[0] ?? null;

  useEffect(() => {
    if (selectedId === null && selectedProvider) {
      setSelectedId(selectedProvider.id);
    }
  }, [selectedId, selectedProvider, setSelectedId]);

  useEffect(() => {
    if (focusZone === 'input') {
      inputRef.current?.focus();
    } else {
      inputRef.current?.blur();
    }
  }, [focusZone]);

  const handleListBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone('filters');
      setFilterIndex(FILTER_VALUES.indexOf(filter));
    }
  };

  const dialogOpen = apiKeyDialogOpen || modelDialogOpen;
  const inInput = focusZone === 'input';
  const inFilters = focusZone === 'filters';
  const inList = focusZone === 'list';
  const inButtons = focusZone === 'buttons';
  const canRemoveKey = selectedProvider?.hasApiKey ?? false;

  const getNextButtonIndex = (current: number, direction: 1 | -1) => {
    const enabled = [true, true, canRemoveKey, true];
    let next = current + direction;
    while (next >= 0 && next < 4) {
      if (enabled[next]) return next;
      next += direction;
    }
    return current;
  };

  useKey('ArrowDown', () => setFocusZone('filters'),
    { enabled: !dialogOpen && inInput, allowInInput: true });
  useKey('Escape', () => setFocusZone('filters'),
    { enabled: !dialogOpen && inInput, allowInInput: true });

  useKey('ArrowUp', () => setFocusZone('input'),
    { enabled: !dialogOpen && inFilters });
  useKey('ArrowDown', () => {
    setFocusZone('list');
    if (filteredProviders.length > 0) {
      setSelectedId(filteredProviders[0].id);
    }
  }, { enabled: !dialogOpen && inFilters });
  useKey('ArrowLeft', () => setFilterIndex((i) => Math.max(0, i - 1)),
    { enabled: !dialogOpen && inFilters });
  useKey('ArrowRight', () => setFilterIndex((i) => Math.min(FILTER_VALUES.length - 1, i + 1)),
    { enabled: !dialogOpen && inFilters });
  useKey('Enter', () => setFilter(FILTER_VALUES[filterIndex]),
    { enabled: !dialogOpen && inFilters });
  useKey(' ', () => setFilter(FILTER_VALUES[filterIndex]),
    { enabled: !dialogOpen && inFilters });

  useKey('ArrowRight', () => { setFocusZone('buttons'); setButtonIndex(0); },
    { enabled: !dialogOpen && inList && !!selectedProvider });

  useKey('ArrowLeft', () => {
    if (buttonIndex === 0) {
      setFocusZone('list');
    } else {
      setButtonIndex((i) => getNextButtonIndex(i, -1));
    }
  }, { enabled: !dialogOpen && inButtons });

  useKey('ArrowRight', () => setButtonIndex((i) => getNextButtonIndex(i, 1)),
    { enabled: !dialogOpen && inButtons });

  useKey('ArrowUp', () => setButtonIndex((i) => getNextButtonIndex(i, -1)),
    { enabled: !dialogOpen && inButtons });
  useKey('ArrowDown', () => setButtonIndex((i) => getNextButtonIndex(i, 1)),
    { enabled: !dialogOpen && inButtons });

  useKey('Enter', () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons });
  useKey(' ', () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons });

  useKey('Escape', () => navigate({ to: '/settings' }), { enabled: !dialogOpen && !inInput });

  useKey('/', () => {
    setFocusZone('input');
  }, { enabled: !dialogOpen && !inInput });

  useEffect(() => {
    if (!selectedProvider && focusZone === 'buttons') {
      setFocusZone('list');
    }
  }, [selectedProvider, focusZone]);

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });

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
      showToast({ variant: 'success', title: 'API Key Saved', message: 'Provider configured' });
    } catch (error) {
      showToast({ variant: 'error', title: 'Failed to Save', message: error instanceof Error ? error.message : 'Unknown error' });
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
      showToast({ variant: 'success', title: 'API Key Removed', message: 'Provider key deleted' });
    } catch (error) {
      showToast({ variant: 'error', title: 'Failed to Remove', message: error instanceof Error ? error.message : 'Unknown error' });
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
      showToast({ variant: 'success', title: 'Provider Activated', message: `${selectedProvider.name} is now active` });
    } catch (error) {
      showToast({ variant: 'error', title: 'Failed to Activate', message: error instanceof Error ? error.message : 'Unknown error' });
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
      showToast({ variant: 'success', title: 'Model Selected', message: `Selected ${modelId}` });
    } catch (error) {
      showToast({ variant: 'error', title: 'Failed to Select Model', message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-gray-500" role="status" aria-live="polite">Loading providers...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-2/5 flex flex-col border-r border-tui-border">
        <ProviderList
          providers={providersWithStatus}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          keyboardEnabled={inList && !dialogOpen}
          onBoundaryReached={handleListBoundary}
          inputRef={inputRef}
          focusedFilterIndex={inFilters ? filterIndex : undefined}
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
