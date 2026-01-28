import { Badge, Button, CapabilityCard, StatusRow } from '@/components/ui';
import { PROVIDER_CAPABILITIES, type ProviderInfo } from '@repo/schemas';

type DisplayStatus = 'configured' | 'needs-key' | 'active';

export interface ProviderWithStatus extends ProviderInfo {
  displayStatus: DisplayStatus;
}

export interface ProviderDetailsProps {
  provider: ProviderWithStatus | null;
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: () => void;
  onSelectProvider: () => void;
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
}: ProviderDetailsProps) {
  if (!provider) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a provider to view details
      </div>
    );
  }

  const capabilities = PROVIDER_CAPABILITIES[provider.id];
  const hasApiKey = provider.displayStatus === 'configured' || provider.displayStatus === 'active';

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
            hasApiKey ? (
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
              <span className="text-gray-500">{provider.defaultModel} (default)</span>
            )
          }
        />
      </section>

      {/* Action Buttons */}
      <section className="mt-auto">
        <div className="flex flex-wrap gap-3 pt-4">
          <Button variant="primary" bracket onClick={onSelectProvider}>
            Select Provider
          </Button>
          <Button variant="secondary" bracket onClick={onSetApiKey}>
            Set API Key
          </Button>
          <Button variant="destructive" bracket onClick={onRemoveKey} disabled={!hasApiKey}>
            Remove Key
          </Button>
          <Button variant="link" bracket onClick={onSelectModel}>
            Select Model...
          </Button>
        </div>
      </section>
      </div>{/* Close content wrapper */}
    </div>
  );
}
