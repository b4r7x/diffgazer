import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { OPENROUTER_PROVIDER_ID, PROVIDER_CAPABILITIES } from "@diffgazer/core/schemas/config";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import type { RefCallback } from "react";
import { CapabilityCard } from "./capability-card";

export interface ProviderActions {
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: () => void;
  onSelectProvider: () => void;
}

export interface ProviderDetailsProps {
  provider: ProviderWithStatus | null;
  actions: ProviderActions;
  isPending?: boolean;
  focusedButtonIndex?: number;
  isFocused?: boolean;
  getButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
}

function getButtonConfig(
  actions: ProviderActions,
  provider: ProviderWithStatus,
  isPending: boolean,
) {
  return [
    {
      action: actions.onSelectProvider,
      label: "Select Provider",
      variant: "primary" as const,
      disabled: isPending,
    },
    {
      action: actions.onSetApiKey,
      label: "Set API Key",
      variant: "secondary" as const,
      disabled: isPending,
    },
    {
      action: actions.onRemoveKey,
      label: "Remove Key",
      variant: "destructive" as const,
      disabled: isPending || !provider.hasApiKey,
    },
    {
      action: actions.onSelectModel,
      label: "Select Model...",
      variant: "link" as const,
      disabled: isPending || !provider.hasApiKey,
    },
  ];
}

function getEmptyModelPlaceholder(provider: ProviderWithStatus): string {
  if (provider.id === OPENROUTER_PROVIDER_ID) return "Model required";
  if (!provider.defaultModel) return "No default model";
  return `${provider.defaultModel} (default)`;
}

export function ProviderDetails({
  provider,
  actions,
  isPending = false,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderDetailsProps) {
  if (!provider) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
          <SectionHeader as="h2" className="mb-0 text-foreground">
            Provider Details
          </SectionHeader>
        </div>
        <EmptyState className="flex-1">Select a provider to view details</EmptyState>
      </div>
    );
  }

  const capabilities = PROVIDER_CAPABILITIES[provider.id];
  if (!capabilities) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
          <SectionHeader as="h2" className="mb-0 text-foreground">
            Provider Details: {provider.name}
          </SectionHeader>
        </div>
        <EmptyState className="flex-1">Unknown provider: {provider.id}</EmptyState>
      </div>
    );
  }

  const buttons = getButtonConfig(actions, provider, isPending);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
        <SectionHeader as="h2" className="mb-0 text-foreground">
          Provider Details: {provider.name}
        </SectionHeader>
        {provider.displayStatus === "active" && (
          <span className="text-2xs text-success-text font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Active
          </span>
        )}
      </div>

      <div className="p-6">
        <section className="mb-6">
          <SectionHeader variant="muted" bordered className="mb-4 border-border text-accent">
            Capabilities
          </SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            <CapabilityCard label="Tool Calling" value={capabilities.toolCalling} />
            <CapabilityCard label="JSON Mode" value={capabilities.jsonMode} />
            <CapabilityCard label="Streaming" value={capabilities.streaming} />
            <CapabilityCard label="Context Window" value={capabilities.contextWindow} />
          </div>
        </section>

        <section className="mb-6">
          <SectionHeader variant="muted" bordered className="mb-4 border-border text-accent">
            Cost Tier
          </SectionHeader>
          <div className="border-l-2 border-success pl-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {capabilities.costDescription}
            </p>
          </div>
        </section>

        <section className="mb-6">
          <SectionHeader variant="muted" bordered className="mb-4 border-border text-accent">
            Status
          </SectionHeader>
          <KeyValue>
            <KeyValue.Item
              label="API Key Status"
              value={
                provider.hasApiKey ? (
                  <Badge variant="info">[ STORED ]</Badge>
                ) : (
                  <span className="text-muted-foreground">Not configured</span>
                )
              }
              bordered
            />
            <KeyValue.Item
              label="Selected Model"
              value={
                provider.model ? (
                  <span className="text-foreground">{provider.model}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {getEmptyModelPlaceholder(provider)}
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
                className={
                  isFocused && focusedButtonIndex === index && !btn.disabled
                    ? "ring-2 ring-info ring-offset-1 ring-offset-background"
                    : ""
                }
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
