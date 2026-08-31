import {
  getEndpointPoolContext,
  getModelBillingPool,
  getModelTierBadge,
  PRODUCT_REGISTRY,
  poolBadgeLabel,
  resolveSelectEndpoint,
} from "@diffgazer/core/providers";
import { useModelSource } from "@diffgazer/core/providers/hooks";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { ClientConfigurationSummary, ModelInfo } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useTerminalDimensions } from "../../../../hooks/use-terminal-dimensions";
import { getModelDetail } from "../../../../lib/model-detail";
import { useTheme } from "../../../../theme/provider";

const MODEL_STEP_RESERVED_ROWS = 12;
// A row costs a second line only when the catalog gives it a detail to print:
// products that publish neither a distinct id nor a description render one line.
const MODEL_ROW_LINES_WITH_DETAIL = 2;

interface ModelStepProps {
  configuration: ClientConfigurationSummary | null;
  isPreparing: boolean;
  onRetry: () => void;
  value?: string | null;
  /** `poolEndpoint` is the billing pool the row runs on, null when it is the bound one. */
  onChange: (modelId: string, poolEndpoint: string | null) => void;
  isActive?: boolean;
  onDownBoundary?: () => void;
}

function ModelRowLabel({
  model,
  poolBadge,
}: {
  model: ModelInfo;
  poolBadge?: string;
}): ReactElement {
  const tierBadge = getModelTierBadge(model.tier);

  return (
    <Box gap={1}>
      <Text>{sanitizeTerminalText(model.name)}</Text>
      {model.recommended && <Badge variant="info">recommended</Badge>}
      {tierBadge && <Badge variant={tierBadge.variant}>{tierBadge.label}</Badge>}
      {poolBadge && <Badge>{poolBadge}</Badge>}
    </Box>
  );
}

interface RetryControlProps {
  onRetry: () => void;
  isActive: boolean;
  onDownBoundary?: () => void;
}

function RetryControl({ onRetry, isActive, onDownBoundary }: RetryControlProps): ReactElement {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (key.downArrow) onDownBoundary?.();
    },
    { isActive: isActive && onDownBoundary !== undefined },
  );

  return (
    <Box flexDirection="column">
      <Button variant="secondary" onPress={onRetry} isActive={isActive}>
        Retry
      </Button>
      <Text color={tokens.muted}>Press r to retry.</Text>
    </Box>
  );
}

interface DiscoveredModelsProps {
  configuration: ClientConfigurationSummary;
  subtitle: string;
  value?: string | null;
  onChange: (modelId: string, poolEndpoint: string | null) => void;
  isActive: boolean;
  onDownBoundary?: () => void;
}

function DiscoveredModels({
  configuration,
  subtitle,
  value,
  onChange,
  isActive,
  onDownBoundary,
}: DiscoveredModelsProps): ReactElement {
  const { tokens } = useTheme();
  const { rows } = useTerminalDimensions();
  // Discovery is a configuration lifecycle concern, not a focus concern: moving
  // focus off this step must not cancel or restart it.
  const source = useModelSource(true, configuration);

  useInput(
    (input) => {
      if (input.toLowerCase() === "r") source.retry();
    },
    {
      isActive:
        isActive &&
        (source.status === "error" || source.status === "skipped" || source.models.length === 0),
    },
  );

  if (source.status === "loading" || source.status === "idle") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Spinner label="Loading models…" />
      </Box>
    );
  }

  if (source.status === "error") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.error}>
          {sanitizeTerminalText(source.error ?? "Model discovery failed.")}
        </Text>
        <RetryControl onRetry={source.retry} isActive={isActive} onDownBoundary={onDownBoundary} />
      </Box>
    );
  }

  if (source.status === "skipped") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.warning}>{sanitizeTerminalText(source.reason ?? "")}</Text>
        <RetryControl onRetry={source.retry} isActive={isActive} onDownBoundary={onDownBoundary} />
      </Box>
    );
  }

  if (source.models.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.muted}>No models available for this configuration.</Text>
        <RetryControl onRetry={source.retry} isActive={isActive} onDownBoundary={onDownBoundary} />
      </Box>
    );
  }

  // No pool selector here: the endpoint step a moment earlier is the wallet
  // control. The badge names the pool each row bills, and the save carries it,
  // so a sibling-only row is reachable at first run without being written
  // against a pool that cannot serve it.
  const poolContext = getEndpointPoolContext(configuration.productId, configuration.endpoint);
  const resolvePoolEndpoint = (modelId: string) => {
    const model = source.models.find((candidate) => candidate.id === modelId);
    if (!model) return null;
    return (
      resolveSelectEndpoint({
        context: poolContext,
        model,
        boundEndpoint: configuration.endpoint,
      }) ?? null
    );
  };
  const rowsWithDetail = source.models.map((model) => {
    const billingPool = getModelBillingPool(poolContext, model);
    return {
      model,
      detail: getModelDetail(model),
      poolBadge: poolBadgeLabel(billingPool),
    };
  });
  const rowLines = rowsWithDetail.some(({ detail }) => detail !== "")
    ? MODEL_ROW_LINES_WITH_DETAIL
    : 1;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>{subtitle}</Text>
      <RadioGroup
        value={value ?? undefined}
        onChange={(modelId) => onChange(modelId, resolvePoolEndpoint(modelId))}
        isActive={isActive}
        wrap={!onDownBoundary}
        onNavigationBoundaryReached={(direction) => {
          if (direction === 1) onDownBoundary?.();
        }}
        maxVisibleItems={Math.max(1, Math.floor((rows - MODEL_STEP_RESERVED_ROWS) / rowLines))}
      >
        {rowsWithDetail.map(({ model, detail, poolBadge }) => (
          <RadioGroup.Item
            key={model.id}
            value={model.id}
            label={<ModelRowLabel model={model} poolBadge={poolBadge} />}
            description={detail === "" ? undefined : sanitizeTerminalText(detail)}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

export function ModelStep({
  configuration,
  isPreparing,
  onRetry,
  value,
  onChange,
  isActive = true,
  onDownBoundary,
}: ModelStepProps): ReactElement {
  const { tokens } = useTheme();

  useInput(
    (input) => {
      if (input.toLowerCase() === "r") onRetry();
    },
    { isActive: isActive && configuration === null && !isPreparing },
  );

  if (configuration === null) {
    return (
      <Box flexDirection="column" gap={1}>
        {isPreparing ? (
          <Spinner label="Preparing configuration…" />
        ) : (
          <>
            <Text color={tokens.muted}>
              Models are discovered from the saved configuration for this product.
            </Text>
            <RetryControl onRetry={onRetry} isActive={isActive} onDownBoundary={onDownBoundary} />
          </>
        )}
      </Box>
    );
  }

  const productName = PRODUCT_REGISTRY[configuration.productId].presentation.name;

  return (
    <DiscoveredModels
      configuration={configuration}
      subtitle={`Select an exact model for ${productName}.`}
      value={value}
      onChange={onChange}
      isActive={isActive}
      onDownBoundary={onDownBoundary}
    />
  );
}
