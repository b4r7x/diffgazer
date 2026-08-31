import type { OnboardingConfigurationDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { EndpointProfileRadioGroup } from "@/components/shared/endpoint-profile-radio-group";

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
  const product = PRODUCT_REGISTRY[productId];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-mono">
        Choose the endpoint tuple for {product.presentation.name}.
      </p>
      <EndpointProfileRadioGroup
        profiles={product.configuration.endpoints}
        value={configurationInput.endpoint}
        onChange={(endpoint) => onChange({ ...configurationInput, endpoint })}
        active={enabled}
        onEnter={() => onCommit?.()}
        onBoundaryReached={onBoundaryReached}
      />
    </div>
  );
}
