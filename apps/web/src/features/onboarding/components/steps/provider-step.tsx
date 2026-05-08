import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Badge } from "@diffgazer/ui/components/badge";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { PROVIDER_CAPABILITIES } from "@diffgazer/core/schemas/config";
import { useOptionHighlight } from "./use-option-highlight";

interface ProviderStepProps {
  value: AIProvider | null;
  onChange: (provider: AIProvider) => void;
  onCommit?: (provider: AIProvider) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function ProviderStep({
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ProviderStepProps) {
  const providerIds = AVAILABLE_PROVIDERS.map((provider) => provider.id as AIProvider);
  const { highlighted: effectiveHighlighted, setHighlighted } = useOptionHighlight(
    value,
    providerIds,
  );
  const handleChange = (provider: string) => {
    setHighlighted(provider);
    onChange(provider as AIProvider);
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!enabled) return;

    if (e.key === "Enter" && effectiveHighlighted) {
      e.preventDefault();
      onChange(effectiveHighlighted as AIProvider);
      onCommit?.(effectiveHighlighted as AIProvider);
      return;
    }

    if (onBoundaryReached && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const isAtStart = effectiveHighlighted === providerIds[0];
      const isAtEnd = effectiveHighlighted === providerIds[providerIds.length - 1];
      if (e.key === "ArrowUp" && isAtStart) {
        e.preventDefault();
        onBoundaryReached("up");
        return;
      }
      if (e.key === "ArrowDown" && isAtEnd) {
        e.preventDefault();
        onBoundaryReached("down");
        return;
      }
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select an AI provider for code reviews.
      </p>
      <RadioGroup
        value={value ?? undefined}
        onChange={handleChange}
        highlighted={enabled ? effectiveHighlighted : null}
        onHighlightChange={setHighlighted}
        onKeyDown={handleKeyDown}
        wrap={false}
        className="space-y-1 border border-tui-border p-1"
      >
        {AVAILABLE_PROVIDERS.map((provider) => {
          const capabilities = PROVIDER_CAPABILITIES[provider.id];
          const tierBadge = capabilities?.tierBadge ?? "PAID";

          return (
            <RadioGroupItem
              key={provider.id}
              value={provider.id}
              label={(
                <span className="flex items-center gap-2">
                  <span>{provider.name}</span>
                  <Badge
                    variant={tierBadge === "FREE" ? "success" : "neutral"}
                    size="sm"
                    className="text-[9px]"
                  >
                    {tierBadge}
                  </Badge>
                </span>
              )}
              description={provider.defaultModel || "Select model after setup"}
            />
          );
        })}
      </RadioGroup>
    </div>
  );
}
