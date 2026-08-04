import { PRODUCT_REGISTRY, useModelSource } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { ClientConfigurationSummary } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/ui/badge";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useTerminalDimensions } from "../../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../../theme/provider";

const MODEL_STEP_RESERVED_ROWS = 12;

interface ModelStepProps {
  configuration: ClientConfigurationSummary | null;
  isPreparing: boolean;
  onRetry: () => void;
  value?: string | null;
  onChange: (modelId: string) => void;
  isActive?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  badges: Array<{ label: string; variant: "info" | "success" | "warning" }>;
}

function modelToOption(model: {
  id: string;
  name: string;
  tier: string;
  recommended?: boolean;
}): ModelOption {
  const badges: ModelOption["badges"] = [];
  if (model.tier === "free") badges.push({ label: "free", variant: "success" });
  if (model.recommended) badges.push({ label: "recommended", variant: "info" });
  return { id: model.id, name: model.name, badges };
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

  const models = source.models.map(modelToOption);

  if (models.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.muted}>No models available for this configuration.</Text>
        <RetryHint />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>{subtitle}</Text>
      <RadioGroup
        value={value ?? undefined}
        onChange={onChange}
        isActive={isActive}
        maxVisibleItems={Math.max(1, rows - MODEL_STEP_RESERVED_ROWS)}
      >
        {models.map((model) => (
          <RadioGroup.Item
            key={model.id}
            value={model.id}
            label={
              <Box gap={1}>
                <Text>{model.name}</Text>
                {model.badges.map((badge) => (
                  <Badge key={badge.label} variant={badge.variant}>
                    {badge.label}
                  </Badge>
                ))}
              </Box>
            }
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
