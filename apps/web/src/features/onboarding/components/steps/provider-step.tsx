import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { SELECTABLE_PRODUCTS } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Callout } from "@diffgazer/ui/components/callout";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useState } from "react";
import { resolveAvailableValue } from "../../lib/select";

const SELECTABLE_PRODUCT_IDS = SELECTABLE_PRODUCTS.map((product) => product.productId);

function isRunnableProductId(value: string | null): value is RunnableProductId {
  return SELECTABLE_PRODUCT_IDS.some((productId) => productId === value);
}

function getTierBadge(productId: RunnableProductId): "FREE" | "PAID" {
  const modes = PRODUCT_REGISTRY[productId].billing.modes as readonly string[];
  return modes.includes("free-tier") ? "FREE" : "PAID";
}

interface RemovedMigrationRecord {
  name: string;
  description: string;
  replacementName: string;
}

interface ProviderStepProps {
  value: RunnableProductId | null;
  onChange: (productId: RunnableProductId) => void;
  onCommit?: (productId: RunnableProductId) => void;
  removedRecord?: RemovedMigrationRecord | null;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function ProviderStep({
  value,
  onChange,
  onCommit,
  removedRecord = null,
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
      {removedRecord ? (
        <Callout tone="warning">
          <Callout.Content>
            <p className="font-mono text-sm">{removedRecord.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{removedRecord.description}</p>
            <p className="mt-2 text-xs">
              Create a {removedRecord.replacementName} configuration or delete this removed record
              from the migration flow.
            </p>
          </Callout.Content>
        </Callout>
      ) : null}
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
          const productId = product.productId as RunnableProductId;
          const tierBadge = getTierBadge(productId);
          return (
            <RadioGroupItem
              key={product.productId}
              value={product.productId}
              label={
                <span className="flex items-center gap-2">
                  <span>{product.name}</span>
                  <Badge
                    variant={tierBadge === "FREE" ? "success" : "neutral"}
                    size="sm"
                    className="text-3xs"
                  >
                    {tierBadge}
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
