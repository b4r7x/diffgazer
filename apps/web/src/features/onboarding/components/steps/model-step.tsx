import { useModelSource } from "@diffgazer/core/providers";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Input } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { type ReactNode, useState } from "react";
import { resolveAvailableValue } from "../../lib/select.js";

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
      <p className="text-sm text-muted-foreground font-mono">{subtitle}</p>
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

export function ModelStep({
  provider,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  const { models, loading, error, isOpenRouter } = useModelSource(true, provider);
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const manualEntryPlaceholder = isOpenRouter
    ? "openai/gpt-4o"
    : (providerInfo?.defaultModel ?? "model-id");
  const manualEntryHint = isOpenRouter
    ? "Enter a model ID manually (e.g. openai/gpt-4o):"
    : "Enter a model ID manually:";
  const ariaLabel = isOpenRouter ? "OpenRouter model ID" : "Model ID";

  if (loading) {
    return (
      <div className="space-y-4">
        <Spinner className="text-muted-foreground">
          {isOpenRouter ? "Loading OpenRouter models..." : "Loading models..."}
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-error-text font-mono">Failed to load models: {error}</p>
        <p className="text-sm text-muted-foreground font-mono">{manualEntryHint}</p>
        <Input
          type="text"
          aria-label={ariaLabel}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={manualEntryPlaceholder}
        />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          No models available. {manualEntryHint}
        </p>
        <Input
          type="text"
          aria-label={ariaLabel}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={manualEntryPlaceholder}
        />
      </div>
    );
  }

  const list = (
    <ModelInfoList
      subtitle={
        isOpenRouter
          ? "Select a model from OpenRouter."
          : `Select a model for ${providerInfo?.name ?? provider}.`
      }
      models={models}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );

  if (isOpenRouter) {
    return <div className="max-h-64 overflow-y-auto scrollbar-hide">{list}</div>;
  }
  return list;
}
