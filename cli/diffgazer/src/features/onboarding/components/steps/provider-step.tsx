import {
  type BillingMode,
  PRODUCT_REGISTRY,
  type RunnableProductId,
  SELECTABLE_PRODUCT_IDS,
} from "@diffgazer/core/providers";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/ui/badge";
import { RadioGroup } from "../../../../components/ui/radio";
import { useTheme } from "../../../../theme/provider";

interface ProviderStepProps {
  value?: RunnableProductId;
  onChange: (productId: RunnableProductId) => void;
  isActive?: boolean;
}

function getTierBadge(productId: RunnableProductId): "FREE" | "PAID" | "LOCAL" | "AMBIENT" {
  const product = PRODUCT_REGISTRY[productId];
  if (product.transportFamily === "local-http") return "LOCAL";
  if (product.transportFamily === "local-cli") return "AMBIENT";
  // Structured billing modes are the badge authority; notice prose describes
  // free tiers it does not offer and omits ones it does.
  const modes: readonly BillingMode[] = product.billing.modes;
  return modes.includes("free-tier") ? "FREE" : "PAID";
}

function getTierBadgeVariant(
  tierBadge: ReturnType<typeof getTierBadge>,
): "success" | "neutral" | "info" {
  if (tierBadge === "FREE") return "success";
  if (tierBadge === "PAID") return "neutral";
  return "info";
}

export function ProviderStep({
  value,
  onChange,
  isActive = true,
}: ProviderStepProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Select an AI provider for code reviews.</Text>
      <RadioGroup
        value={value}
        onChange={(next) => onChange(next as RunnableProductId)}
        isActive={isActive}
      >
        {SELECTABLE_PRODUCT_IDS.map((productId) => {
          const product = PRODUCT_REGISTRY[productId];
          const tierBadge = getTierBadge(productId);
          return (
            <RadioGroup.Item
              key={productId}
              value={productId}
              label={
                <Box gap={1}>
                  <Text>{product.presentation.name}</Text>
                  <Badge variant={getTierBadgeVariant(tierBadge)}>{tierBadge}</Badge>
                </Box>
              }
              description={product.presentation.description}
            />
          );
        })}
      </RadioGroup>
    </Box>
  );
}
