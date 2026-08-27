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
import { useTerminalDimensions } from "../../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../../theme/provider";

// Wizard chrome around the picker: header, progress, title, subtitle, actions, footer.
const PROVIDER_STEP_RESERVED_ROWS = 12;
// A name line plus a description that wraps once inside the 80-column wizard box.
const PROVIDER_ROW_LINES = 3;

interface ProviderStepProps {
  value?: RunnableProductId;
  onChange: (productId: RunnableProductId) => void;
  isActive?: boolean;
  onDownBoundary?: () => void;
}

export function ProviderStep({
  value,
  onChange,
  isActive = true,
  onDownBoundary,
}: ProviderStepProps): ReactElement {
  const { tokens } = useTheme();
  const { rows } = useTerminalDimensions();

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Select an AI provider for code reviews.</Text>
      <RadioGroup
        value={value}
        onChange={(next) => onChange(next as RunnableProductId)}
        isActive={isActive}
        wrap={!onDownBoundary}
        onNavigationBoundaryReached={(direction) => {
          if (direction === 1) onDownBoundary?.();
        }}
        maxVisibleItems={Math.max(
          1,
          Math.floor((rows - PROVIDER_STEP_RESERVED_ROWS) / PROVIDER_ROW_LINES),
        )}
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
