import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Badge } from "@diffgazer/ui/components/badge";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { PROVIDER_CAPABILITIES } from "@diffgazer/core/schemas/config";
import { resolveAvailableValue } from "@diffgazer/core/select";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";

const PROVIDER_IDS = AVAILABLE_PROVIDERS.map((provider) => provider.id);

function isProviderId(value: string | null): value is AIProvider {
  return PROVIDER_IDS.some((providerId) => providerId === value);
}

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
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const effectiveHighlighted = resolveAvailableValue(PROVIDER_IDS, highlighted, value);
  const handleChange = (provider: string) => {
    if (!isProviderId(provider)) return;
    setHighlighted(provider);
    onChange(provider);
  };

  const handleEnter = (provider: string) => {
    if (!isProviderId(provider)) return;
    onCommit?.(provider);
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
        onEnter={handleEnter}
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        keyboardNavigation={enabled}
        autoFocus={enabled}
        activationMode="manual"
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
                    className="text-3xs"
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
