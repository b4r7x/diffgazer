import {
  BILLING_TIER_BADGES,
  getBillingTier,
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
          const tierBadge = BILLING_TIER_BADGES[getBillingTier(productId)];
          return (
            <RadioGroup.Item
              key={productId}
              value={productId}
              label={
                <Box gap={1}>
                  <Text>{product.presentation.name}</Text>
                  <Badge variant={tierBadge.variant}>{tierBadge.label}</Badge>
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
