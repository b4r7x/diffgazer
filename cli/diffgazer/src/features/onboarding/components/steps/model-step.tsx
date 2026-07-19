import { useModelSource } from "@diffgazer/core/providers";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/ui/badge";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useTerminalDimensions } from "../../../../hooks/use-terminal-dimensions";
import { terminalCellWidth } from "../../../../lib/terminal-width";
import { useTheme } from "../../../../theme/provider";

const MODEL_STEP_RESERVED_ROWS = 12;

function getWrappedRowCount(text: string, width: number): number {
  return Math.max(Math.ceil(terminalCellWidth(text) / Math.max(width, 1)), 1);
}

interface ModelStepProps {
  value?: string;
  onChange: (v: string) => void;
  provider: AIProvider;
  isActive?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  badges: Array<{ label: string; variant: "info" | "success" | "warning" }>;
}

function modelInfoToOption(info: ModelInfo): ModelOption {
  const badges: ModelOption["badges"] = [];
  if (info.tier === "free") {
    badges.push({ label: "free", variant: "success" });
  }
  if (info.recommended) {
    badges.push({ label: "recommended", variant: "info" });
  }
  return { id: info.id, name: info.name, badges };
}

function getSubtitle(provider: string): string {
  const info = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  return `Select a model for ${info?.name ?? provider}.`;
}

export function ModelStep({
  value,
  onChange,
  provider,
  isActive = true,
}: ModelStepProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, rows } = useTerminalDimensions();
  const {
    models: sourceModels,
    loading,
    error,
    isOpenRouter,
    source,
    fetchedAt,
    retry,
  } = useModelSource(true, provider);

  const subtitle = isOpenRouter ? "Select a model from OpenRouter." : getSubtitle(provider);
  let fallbackNotice: string | null = null;
  if (source === "cache") {
    fallbackNotice = `Using cached catalog data from ${fetchedAt ?? "an unknown time"}.`;
  } else if (source === "snapshot") {
    fallbackNotice = "Using the bundled model catalog because live catalog data is unavailable.";
  }

  useInput(
    (input) => {
      if (input.toLowerCase() === "r") retry();
    },
    {
      isActive:
        isActive && (Boolean(error) || sourceModels.length === 0 || fallbackNotice !== null),
    },
  );

  if (loading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Spinner label={isOpenRouter ? "Loading OpenRouter models…" : "Loading models…"} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text color={tokens.error}>Failed to load models: {error}</Text>
        <Text color={tokens.muted}>Press r to retry.</Text>
      </Box>
    );
  }

  const models = sourceModels.map(modelInfoToOption);

  if (models.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text dimColor>No models available for this provider.</Text>
        {fallbackNotice ? <Text color={tokens.warning}>{fallbackNotice}</Text> : null}
        <Text color={tokens.muted}>Press r to retry.</Text>
      </Box>
    );
  }

  const fallbackMessage = fallbackNotice ? `${fallbackNotice} Press r to retry.` : null;
  const fallbackRows = fallbackMessage
    ? getWrappedRowCount(fallbackMessage, Math.max(columns - 4, 1))
    : 0;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>{subtitle}</Text>
      {fallbackNotice ? <Text color={tokens.warning}>{fallbackMessage}</Text> : null}
      <RadioGroup
        value={value}
        onChange={onChange}
        isActive={isActive}
        maxVisibleItems={Math.max(1, rows - MODEL_STEP_RESERVED_ROWS - fallbackRows)}
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
