import { useState, type ReactNode } from "react";
import { AVAILABLE_PROVIDERS, GEMINI_MODEL_INFO, GLM_MODEL_INFO } from "@diffgazer/core/schemas/config";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Badge } from "@diffgazer/ui/components/badge";
import { useOpenRouterModels } from "@/hooks/use-openrouter-models";
import { resolveAvailableValue } from "@/lib/selectable-values";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";

interface ModelStepProps {
  provider: AIProvider;
  value: string | null;
  onChange: (model: string) => void;
  onCommit?: (model: string) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function getStaticModels(provider: AIProvider): ModelInfo[] {
  switch (provider) {
    case "gemini":
      return Object.values(GEMINI_MODEL_INFO);
    case "zai":
    case "zai-coding":
      return Object.values(GLM_MODEL_INFO);
    default:
      return [];
  }
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

function StaticModelList({
  provider,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  const models = getStaticModels(provider);
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const modelIds = models.map((model) => model.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select a model for {providerInfo?.name ?? provider}.
      </p>
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
                  <Badge variant="success" size="sm" className="text-[9px]">
                    RECOMMENDED
                  </Badge>
                )}
                <Badge
                  variant={model.tier === "free" ? "success" : "neutral"}
                  size="sm"
                  className="text-[9px]"
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

function OpenRouterModelList({
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: Omit<ModelStepProps, "provider">) {
  const { models, loading, error } = useOpenRouterModels(true, "openrouter");
  const modelIds = models.map((model) => model.id);

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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select a model from OpenRouter.
      </p>
      <div className="max-h-64 overflow-y-auto scrollbar-hide">
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
                  <Badge
                    variant={model.tier === "free" ? "success" : "neutral"}
                    size="sm"
                    className="text-[9px]"
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
    <StaticModelList
      provider={provider}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}
