import { useOpenRouterModelsMapped, useProviderModelsMapped } from "@diffgazer/core/providers";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { resolveAvailableValue } from "@diffgazer/core/select";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Input } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { type ReactNode, useState } from "react";

interface ModelStepProps {
  provider: AIProvider;
  value: string | null;
  onChange: (model: string) => void;
  onCommit?: (model: string) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

interface ModelRadioGroupProps extends Omit<ModelStepProps, "provider"> {
  modelIds: string[];
  children: ReactNode;
  className?: string;
}

function ModelRadioGroup({
  modelIds,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
  children,
  className,
}: ModelRadioGroupProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const effectiveHighlighted = resolveAvailableValue(modelIds, highlighted, value);

  const handleChange = (nextValue: string) => {
    setHighlighted(nextValue);
    onChange(nextValue);
  };

  const handleEnter = (nextValue: string) => {
    setHighlighted(nextValue);
    onCommit?.(nextValue);
  };

  return (
    <RadioGroup
      value={value ?? undefined}
      onChange={handleChange}
      highlighted={enabled ? effectiveHighlighted : null}
      onHighlightChange={setHighlighted}
      onEnter={handleEnter}
      onNavigationBoundaryReached={(direction, event) => {
        const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
        if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
      }}
      keyboardNavigation={enabled}
      autoFocus={enabled}
      activationMode="manual"
      wrap={false}
      className={className}
    >
      {children}
    </RadioGroup>
  );
}

interface ModelInfoListProps extends Omit<ModelStepProps, "provider"> {
  subtitle: string;
  models: ModelInfo[];
}

function ModelInfoList({
  subtitle,
  models,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelInfoListProps) {
  const modelIds = models.map((model) => model.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">{subtitle}</p>
      <ModelRadioGroup
        modelIds={modelIds}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        enabled={enabled}
        onBoundaryReached={onBoundaryReached}
        className="space-y-1"
      >
        {models.map((model) => (
          <RadioGroupItem
            key={model.id}
            value={model.id}
            label={
              <span className="flex items-center gap-2">
                {model.name}
                {model.recommended && (
                  <Badge variant="success" size="sm" className="text-3xs">
                    RECOMMENDED
                  </Badge>
                )}
                <Badge
                  variant={model.tier === "free" ? "success" : "neutral"}
                  size="sm"
                  className="text-3xs"
                >
                  {model.tier.toUpperCase()}
                </Badge>
              </span>
            }
            description={model.description}
          />
        ))}
      </ModelRadioGroup>
    </div>
  );
}

function CatalogModelList({
  provider,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  const { models, loading, error } = useProviderModelsMapped(true, provider);
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tui-muted font-mono">Loading models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tui-red font-mono">Failed to load models: {error}</p>
        <p className="text-sm text-tui-muted font-mono">Enter a model ID manually:</p>
        <Input
          type="text"
          aria-label="Model ID"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={providerInfo?.defaultModel ?? "model-id"}
        />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tui-muted font-mono">
          No models available. Enter a model ID manually:
        </p>
        <Input
          type="text"
          aria-label="Model ID"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={providerInfo?.defaultModel ?? "model-id"}
        />
      </div>
    );
  }

  return (
    <ModelInfoList
      subtitle={`Select a model for ${providerInfo?.name ?? provider}.`}
      models={models}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}

function OpenRouterModelList({
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: Omit<ModelStepProps, "provider">) {
  const { models, loading, error } = useOpenRouterModelsMapped(true, "openrouter");

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tui-muted font-mono">Loading OpenRouter models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tui-red font-mono">Failed to load models: {error}</p>
        <p className="text-sm text-tui-muted font-mono">
          Enter a model ID manually (e.g. openai/gpt-4o):
        </p>
        <Input
          type="text"
          aria-label="OpenRouter model ID"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="openai/gpt-4o"
        />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tui-muted font-mono">
          No models available. Enter a model ID manually (e.g. openai/gpt-4o):
        </p>
        <Input
          type="text"
          aria-label="OpenRouter model ID"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="openai/gpt-4o"
        />
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto scrollbar-hide">
      <ModelInfoList
        subtitle="Select a model from OpenRouter."
        models={models}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        enabled={enabled}
        onBoundaryReached={onBoundaryReached}
      />
    </div>
  );
}

export function ModelStep({
  provider,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  if (provider === "openrouter") {
    return (
      <OpenRouterModelList
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        enabled={enabled}
        onBoundaryReached={onBoundaryReached}
      />
    );
  }
  return (
    <CatalogModelList
      provider={provider}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}
