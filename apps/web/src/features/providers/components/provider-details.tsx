import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapabilityCard } from '@/components/ui/capability-card';
import { StatusRow } from '@/components/ui/status-row';
import { PROVIDER_CAPABILITIES, OPENROUTER_PROVIDER_ID } from '@/features/providers/constants';
import type { ProviderWithStatus } from '../types';

export interface ProviderDetailsProps {
  provider: ProviderWithStatus | null;
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: () => void;
  onSelectProvider: () => void;
  disableSelectProvider?: boolean;
  focusedButtonIndex?: number;
  isFocused?: boolean;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-tui-violet uppercase mb-4 tracking-widest flex items-center">
      {children} <span className="ml-2 flex-1 h-px bg-tui-border" />
    </h3>
  );
}

export function ProviderDetails({
  provider,
  onSetApiKey,
  onSelectModel,
  onRemoveKey,
  onSelectProvider,
  disableSelectProvider = false,
  focusedButtonIndex,
  isFocused = false,
}: ProviderDetailsProps) {
  if (!provider) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a provider to view details
      </div>
    );
  }

  const capabilities = PROVIDER_CAPABILITIES[provider.id];
  if (!capabilities) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Unknown provider: {provider.id}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-tui-border bg-tui-selection/30 flex justify-between items-center">
        <h2 className="text-sm font-bold text-tui-fg uppercase tracking-wide">
          Provider Details: {provider.name}
        </h2>
        {provider.displayStatus === 'active' && (
          <span className="text-[10px] text-tui-green font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tui-green"></span> Active
          </span>
        )}
      </div>

      <div className="p-6">{/* Content wrapper */}

      {/* Capabilities */}
      <section className="mb-6">
        <SectionHeader>Capabilities</SectionHeader>
        <div className="grid grid-cols-2 gap-4">
          <CapabilityCard label="Tool Calling" value={capabilities.toolCalling} />
          <CapabilityCard label="JSON Mode" value={capabilities.jsonMode} />
          <CapabilityCard label="Streaming" value={capabilities.streaming} />
          <CapabilityCard label="Context Window" value={capabilities.contextWindow} />
        </div>
      </section>

      {/* Cost Tier */}
      <section className="mb-6">
        <SectionHeader>Cost Tier</SectionHeader>
        <div className="border-l-2 border-tui-green pl-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            {capabilities.costDescription}
          </p>
        </div>
      </section>

      {/* Status Rows */}
      <section className="mb-6">
        <SectionHeader>Status</SectionHeader>
        <StatusRow
          label="API Key Status"
          value={
            provider.hasApiKey ? (
              <Badge variant="stored">[ STORED ]</Badge>
            ) : (
              <span className="text-gray-500">Not configured</span>
            )
          }
        />
        <StatusRow
          label="Selected Model"
          value={
            provider.model ? (
              <span className="text-tui-fg">{provider.model}</span>
            ) : (
              <span className="text-gray-500">
                {provider.id === OPENROUTER_PROVIDER_ID
                  ? "Model required"
                  : `${provider.defaultModel} (default)`}
              </span>
            )
          }
        />
      </section>

      {/* Action Buttons */}
      <section className="mt-auto">
        <div className="flex flex-wrap gap-3 pt-4">
          {[
            { action: onSelectProvider, label: 'Select Provider', variant: 'primary' as const, disabled: disableSelectProvider },
            { action: onSetApiKey, label: 'Set API Key', variant: 'secondary' as const },
            { action: onRemoveKey, label: 'Remove Key', variant: 'destructive' as const, disabled: !provider.hasApiKey },
            { action: onSelectModel, label: 'Select Model...', variant: 'link' as const },
          ].map((btn, index) => (
            <Button
              key={btn.label}
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
      </div>{/* Close content wrapper */}
    </div>
  );
}
