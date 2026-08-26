import type { OnboardingConfigurationDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useState } from "react";

interface EndpointStepProps {
  productId: RunnableProductId;
  value: OnboardingConfigurationDraft;
  onChange: (configurationInput: OnboardingConfigurationDraft) => void;
  onCommit?: () => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function EndpointStep({
  productId,
  value: configurationInput,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: EndpointStepProps) {
  const [highlightedEndpoint, setHighlightedEndpoint] = useState<string | null>(null);
  const product = PRODUCT_REGISTRY[productId];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-mono">
        Choose the endpoint tuple for {product.presentation.name}.
      </p>
      <RadioGroup
        aria-label="Endpoint profile"
        value={configurationInput.endpoint}
        onChange={(endpoint) => {
          setHighlightedEndpoint(endpoint);
          onChange({ ...configurationInput, endpoint });
        }}
        highlighted={enabled ? highlightedEndpoint : null}
        onHighlightChange={setHighlightedEndpoint}
        onEnter={() => onCommit?.()}
        autoFocus={enabled}
        keyboardNavigation={enabled}
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection === null) return;
          onBoundaryReached?.(verticalDirection);
        }}
        wrap={false}
        className="space-y-1"
      >
        {product.configuration.endpoints.map((endpoint) => (
          <RadioGroupItem
            key={endpoint.id}
            value={endpoint.endpoint}
            label={endpoint.label}
            description={endpoint.endpoint}
            onFocus={() => setHighlightedEndpoint(endpoint.endpoint)}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
