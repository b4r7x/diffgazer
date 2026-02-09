import { useEffect, useRef, useState } from "react";
import { Badge, RadioGroup, RadioGroupItem } from "@diffgazer/ui";
import { useNavigation } from "@diffgazer/keyboard";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import type { AIProvider } from "@diffgazer/schemas/config";
import { PROVIDER_CAPABILITIES } from "@/config/constants";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedProvider, setFocusedProvider] = useState<AIProvider | null>(
    AVAILABLE_PROVIDERS[0]?.id ?? null,
  );

  const providerIds = AVAILABLE_PROVIDERS.map((provider) => provider.id as AIProvider);

  useEffect(() => {
    if (!focusedProvider || !providerIds.includes(focusedProvider)) {
      setFocusedProvider(providerIds[0] ?? null);
    }
  }, [focusedProvider, providerIds]);

  useEffect(() => {
    if (!value && providerIds[0]) {
      onChange(providerIds[0]);
    }
  }, [onChange, providerIds, value]);

  const handleSelect = (providerId: string) => {
    onChange(providerId as AIProvider);
  };

  const handleEnter = (providerId: string) => {
    const resolvedProvider = providerId as AIProvider;
    onChange(resolvedProvider);
    onCommit?.(resolvedProvider);
  };

  const { focusedValue } = useNavigation({
    containerRef,
    role: "radio",
    value: focusedProvider,
    initialValue: providerIds[0] ?? null,
    onValueChange: (providerId) => setFocusedProvider(providerId as AIProvider),
    onSelect: handleSelect,
    onEnter: handleEnter,
    wrap: false,
    enabled,
    onBoundaryReached,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select an AI provider for code reviews.
      </p>
      <RadioGroup
        ref={containerRef}
        value={value ?? undefined}
        onValueChange={onChange}
        focusedValue={enabled ? focusedValue : null}
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
