import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RadioGroup, RadioGroupItem } from "diffui/components/radio";
import { Badge } from "diffui/components/badge";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import type { AIProvider } from "@diffgazer/schemas/config";
import { PROVIDER_CAPABILITIES } from "@diffgazer/schemas/config";

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
  const [highlighted, setHighlighted] = useState<string | null>(
    AVAILABLE_PROVIDERS[0]?.id ?? null,
  );

  const providerIds = AVAILABLE_PROVIDERS.map((provider) => provider.id as AIProvider);

  useEffect(() => {
    if (!value && providerIds[0]) {
      onChange(providerIds[0]);
    }
  }, [onChange, providerIds, value]);

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!enabled) return;

    if (e.key === "Enter" && highlighted) {
      e.preventDefault();
      onChange(highlighted as AIProvider);
      onCommit?.(highlighted as AIProvider);
      return;
    }

    if (onBoundaryReached && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const isAtStart = highlighted === providerIds[0];
      const isAtEnd = highlighted === providerIds[providerIds.length - 1];
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
        onChange={onChange as (value: string) => void}
        highlighted={enabled ? highlighted : null}
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
