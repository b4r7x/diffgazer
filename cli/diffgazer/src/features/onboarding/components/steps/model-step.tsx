import { getModelTierBadge, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { useModelSource } from "@diffgazer/core/providers/hooks";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { ClientConfigurationSummary, ModelInfo } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/ui/badge";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useTerminalDimensions } from "../../../../hooks/use-terminal-dimensions";
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
  onChange: (modelId: string) => void;
  isActive?: boolean;
}

/**
 * The exact id leads the secondary line because it is the string this step saves
 * and a review pins: the catalog publishes distinct routes under one display
 * name (two OpenRouter entries are both "Nano Banana Pro"), so the name alone
 * cannot identify the model. The context blurb trails it, and when upstream
 * publishes no display name the two are equal and only the row title is shown.
 */
function getModelDetail(model: ModelInfo): string {
  const parts = model.id === model.name ? [] : [model.id];
  if (model.description) parts.push(model.description);
  return parts.join(" · ");
}

function ModelRowLabel({ model }: { model: ModelInfo }): ReactElement {
  const tierBadge = getModelTierBadge(model.tier);

  return (
    <Box gap={1}>
      <Text>{sanitizeTerminalText(model.name)}</Text>
      {model.recommended && <Badge variant="info">recommended</Badge>}
      {tierBadge && <Badge variant={tierBadge.variant}>{tierBadge.label}</Badge>}
    </Box>
  );
}

function RetryHint(): ReactElement {
  const { tokens } = useTheme();
  return <Text color={tokens.muted}>Press r to retry.</Text>;
}

interface DiscoveredModelsProps {
  configuration: ClientConfigurationSummary;
  subtitle: string;
  value?: string | null;
  onChange: (modelId: string) => void;
  isActive: boolean;
}

function DiscoveredModels({
  configuration,
  subtitle,
  value,
  onChange,
  isActive,
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
        <RetryHint />
      </Box>
    );
  }

  if (source.status === "skipped") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.warning}>{sanitizeTerminalText(source.reason ?? "")}</Text>
        <RetryHint />
      </Box>
    );
  }

  if (source.models.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.muted}>No models available for this configuration.</Text>
        <RetryHint />
      </Box>
    );
  }

  const rowsWithDetail = source.models.map((model) => ({
    model,
    detail: getModelDetail(model),
  }));
  const rowLines = rowsWithDetail.some(({ detail }) => detail !== "")
    ? MODEL_ROW_LINES_WITH_DETAIL
    : 1;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>{subtitle}</Text>
      <RadioGroup
        value={value ?? undefined}
        onChange={onChange}
        isActive={isActive}
        maxVisibleItems={Math.max(1, Math.floor((rows - MODEL_STEP_RESERVED_ROWS) / rowLines))}
      >
        {rowsWithDetail.map(({ model, detail }) => (
          <RadioGroup.Item
            key={model.id}
            value={model.id}
            label={<ModelRowLabel model={model} />}
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
            <RetryHint />
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
    />
  );
}
