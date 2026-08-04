import { BILLING_TIER_BADGES, getBillingTier } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { SELECTABLE_PRODUCTS } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useState } from "react";
import { resolveAvailableValue } from "../../lib/select";

const SELECTABLE_PRODUCT_IDS = SELECTABLE_PRODUCTS.map((product) => product.productId);

function isRunnableProductId(value: string | null): value is RunnableProductId {
  return SELECTABLE_PRODUCT_IDS.some((productId) => productId === value);
}

interface ProviderStepProps {
  value: RunnableProductId | null;
  onChange: (productId: RunnableProductId) => void;
  onCommit?: (productId: RunnableProductId) => void;
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
  const effectiveHighlighted = resolveAvailableValue(SELECTABLE_PRODUCT_IDS, highlighted, value);

  const handleChange = (productId: string) => {
    if (!isRunnableProductId(productId)) return;
    setHighlighted(productId);
    onChange(productId);
  };

  const handleEnter = (productId: string) => {
    if (!isRunnableProductId(productId)) return;
    onCommit?.(productId);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-mono">Select a product for code reviews.</p>
      <RadioGroup
        aria-label="Select product"
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
        className="space-y-1"
      >
        {SELECTABLE_PRODUCTS.map((product) => {
          const tierBadge = BILLING_TIER_BADGES[getBillingTier(product.productId)];
          return (
            <RadioGroupItem
              key={product.productId}
              value={product.productId}
              label={
                <span className="flex items-center gap-2">
                  <span>{product.name}</span>
                  <Badge variant={tierBadge.variant} size="sm" className="text-3xs">
                    {tierBadge.label}
                  </Badge>
                </span>
              }
              description={product.description}
            />
          );
        })}
      </RadioGroup>
    </div>
  );
}
