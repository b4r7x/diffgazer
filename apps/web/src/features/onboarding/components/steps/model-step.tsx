import { useEffect, useState, type KeyboardEvent } from "react";
import { AVAILABLE_PROVIDERS, GEMINI_MODEL_INFO, GLM_MODEL_INFO } from "@diffgazer/core/schemas/config";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Badge } from "@diffgazer/ui/components/badge";
import { useOpenRouterModels } from "@/hooks/use-openrouter-models";

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
  const [highlighted, setHighlighted] = useState<string | null>(modelIds[0] ?? null);

  useEffect(() => {
    if (!highlighted || !modelIds.includes(highlighted)) {
      setHighlighted(modelIds[0] ?? null);
    }
  }, [highlighted, modelIds]);

  useEffect(() => {
    const firstModelId = modelIds[0];
    if (!firstModelId) return;
    if (!value || !modelIds.includes(value)) {
      onChange(firstModelId);
    }
  }, [modelIds, onChange, value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && highlighted) {
      onChange(highlighted);
      onCommit?.(highlighted);
      return;
    }
    if (!onBoundaryReached) return;
    const idx = modelIds.indexOf(highlighted ?? "");
    if (e.key === "ArrowUp" && idx === 0) onBoundaryReached("up");
    if (e.key === "ArrowDown" && idx === modelIds.length - 1) onBoundaryReached("down");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select a model for {providerInfo?.name ?? provider}.
      </p>
      <RadioGroup
        value={value ?? undefined}
        onChange={onChange}
        highlighted={enabled ? highlighted : null}
        onHighlightChange={setHighlighted}
        onKeyDown={handleKeyDown}
        wrap={false}
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
      </RadioGroup>
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
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (modelIds.length === 0) {
      setHighlighted(null);
      return;
    }
    if (!highlighted || !modelIds.includes(highlighted)) {
      setHighlighted(modelIds[0] ?? null);
    }
  }, [highlighted, modelIds]);

  useEffect(() => {
    const firstModelId = modelIds[0];
    if (!firstModelId) return;
    if (!value || !modelIds.includes(value)) {
      onChange(firstModelId);
    }
  }, [modelIds, onChange, value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && highlighted) {
      onChange(highlighted);
      onCommit?.(highlighted);
      return;
    }
    if (!onBoundaryReached) return;
    const idx = modelIds.indexOf(highlighted ?? "");
    if (e.key === "ArrowUp" && idx === 0) onBoundaryReached("up");
    if (e.key === "ArrowDown" && idx === modelIds.length - 1) onBoundaryReached("down");
  };

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
        <RadioGroup
          value={value ?? undefined}
          onChange={onChange}
          highlighted={enabled ? highlighted : null}
          onHighlightChange={setHighlighted}
          onKeyDown={handleKeyDown}
          wrap={false}
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
        </RadioGroup>
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
