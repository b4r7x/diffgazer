import { Badge } from '@diffgazer/ui/components/badge';
import { Button } from '@diffgazer/ui/components/button';
import { SectionHeader } from '@diffgazer/ui/components/section-header';
import { KeyValue } from '@diffgazer/ui/components/key-value';
import { EmptyState } from '@diffgazer/ui/components/empty-state';
import type { RefCallback } from "react";
import { CapabilityCard } from './capability-card';
import { PROVIDER_CAPABILITIES, OPENROUTER_PROVIDER_ID } from '@diffgazer/core/schemas/config';
import type { ProviderWithStatus } from '@diffgazer/core/schemas/config';

export interface ProviderActions {
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: () => void;
  onSelectProvider: () => void;
}

export interface ProviderDetailsProps {
  provider: ProviderWithStatus | null;
  actions: ProviderActions;
  disableSelectProvider?: boolean;
  focusedButtonIndex?: number;
  isFocused?: boolean;
  getButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
}

function getButtonConfig(actions: ProviderActions, provider: ProviderWithStatus, disableSelectProvider: boolean) {
  return [
    { action: actions.onSelectProvider, label: 'Select Provider', variant: 'primary' as const, disabled: disableSelectProvider },
    { action: actions.onSetApiKey, label: 'Set API Key', variant: 'secondary' as const },
    { action: actions.onRemoveKey, label: 'Remove Key', variant: 'destructive' as const, disabled: !provider.hasApiKey },
    { action: actions.onSelectModel, label: 'Select Model...', variant: 'link' as const },
  ];
}

export function ProviderDetails({
  provider,
  actions,
  disableSelectProvider = false,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderDetailsProps) {
  if (!provider) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-tui-border bg-tui-selection/30 flex justify-between items-center">
          <SectionHeader as="h2" className="mb-0 text-tui-fg">
            Provider Details
          </SectionHeader>
        </div>
        <EmptyState className="flex-1">
          Select a provider to view details
        </EmptyState>
      </div>
    );
  }

  const capabilities = PROVIDER_CAPABILITIES[provider.id];
  if (!capabilities) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-tui-border bg-tui-selection/30 flex justify-between items-center">
          <SectionHeader as="h2" className="mb-0 text-tui-fg">
            Provider Details: {provider.name}
          </SectionHeader>
        </div>
        <EmptyState className="flex-1">
          Unknown provider: {provider.id}
        </EmptyState>
      </div>
    );
  }

  const buttons = getButtonConfig(actions, provider, disableSelectProvider);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-tui-border bg-tui-selection/30 flex justify-between items-center">
        <SectionHeader as="h2" className="mb-0 text-tui-fg">
          Provider Details: {provider.name}
        </SectionHeader>
        {provider.displayStatus === 'active' && (
          <span className="text-[10px] text-tui-green font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tui-green"></span> Active
          </span>
        )}
      </div>

      <div className="p-6">
      <section className="mb-6">
        <SectionHeader variant="muted" bordered className="mb-4 border-tui-border text-tui-violet">Capabilities</SectionHeader>
        <div className="grid grid-cols-2 gap-4">
          <CapabilityCard label="Tool Calling" value={capabilities.toolCalling} />
          <CapabilityCard label="JSON Mode" value={capabilities.jsonMode} />
          <CapabilityCard label="Streaming" value={capabilities.streaming} />
          <CapabilityCard label="Context Window" value={capabilities.contextWindow} />
        </div>
      </section>

      <section className="mb-6">
        <SectionHeader variant="muted" bordered className="mb-4 border-tui-border text-tui-violet">Cost Tier</SectionHeader>
        <div className="border-l-2 border-tui-green pl-4">
          <p className="text-xs text-tui-muted leading-relaxed">
            {capabilities.costDescription}
          </p>
        </div>
      </section>

      <section className="mb-6">
        <SectionHeader variant="muted" bordered className="mb-4 border-tui-border text-tui-violet">Status</SectionHeader>
        <KeyValue>
          <KeyValue.Item
            label="API Key Status"
            value={
              provider.hasApiKey ? (
                <Badge variant="info">[ STORED ]</Badge>
              ) : (
                <span className="text-tui-muted">Not configured</span>
              )
            }
            bordered
          />
          <KeyValue.Item
            label="Selected Model"
            value={
              provider.model ? (
                <span className="text-tui-fg">{provider.model}</span>
              ) : (
                <span className="text-tui-muted">
                  {provider.id === OPENROUTER_PROVIDER_ID
                    ? "Model required"
                    : `${provider.defaultModel} (default)`}
                </span>
              )
            }
            bordered
          />
        </KeyValue>
      </section>

      <section className="mt-auto">
        <div className="flex flex-wrap gap-3 pt-4">
          {buttons.map((btn, index) => (
            <Button
              key={btn.label}
              {...getButtonProps?.(index)}
              variant={btn.variant}
              bracket
              onClick={btn.action}
              disabled={btn.disabled}
              className={isFocused && focusedButtonIndex === index ? 'ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg' : ''}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}
