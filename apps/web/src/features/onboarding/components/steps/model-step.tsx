import { useRef } from "react";
import { AVAILABLE_PROVIDERS, GEMINI_MODEL_INFO, GLM_MODEL_INFO } from "@stargazer/schemas/config";
import type { AIProvider, ModelInfo } from "@stargazer/schemas/config";
import { RadioGroup, RadioGroupItem, Badge } from "@stargazer/ui";
import { useNavigation } from "@stargazer/keyboard";
import { useOpenRouterModels } from "@/hooks/use-openrouter-models";

interface ModelStepProps {
  provider: AIProvider;
  value: string | null;
  onChange: (model: string) => void;
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

function StaticModelList({ provider, value, onChange }: ModelStepProps) {
  const models = getStaticModels(provider);
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown, focusedValue } = useNavigation({
    mode: "local",
    containerRef,
    role: "radio",
    value,
    onValueChange: onChange,
    onSelect: onChange,
    onEnter: onChange,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select a model for {providerInfo?.name ?? provider}.
      </p>
      <RadioGroup ref={containerRef} value={value ?? undefined} onValueChange={onChange} onKeyDown={onKeyDown} focusedValue={focusedValue} className="space-y-1">
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

function OpenRouterModelList({ value, onChange }: Omit<ModelStepProps, "provider">) {
  const { models, loading, error } = useOpenRouterModels(true, "openrouter");
  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown, focusedValue } = useNavigation({
    mode: "local",
    containerRef,
    role: "radio",
    value,
    onValueChange: onChange,
    onSelect: onChange,
    onEnter: onChange,
  });

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
        <RadioGroup ref={containerRef} value={value ?? undefined} onValueChange={onChange} onKeyDown={onKeyDown} focusedValue={focusedValue} className="space-y-1">
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

export function ModelStep({ provider, value, onChange }: ModelStepProps) {
  if (provider === "openrouter") {
    return <OpenRouterModelList value={value} onChange={onChange} />;
  }
  return <StaticModelList provider={provider} value={value} onChange={onChange} />;
}
