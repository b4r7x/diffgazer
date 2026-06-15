import { useModelSource } from "@diffgazer/core/providers";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useTheme } from "../../../../theme/provider";

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
  const { models: sourceModels, loading, error, isOpenRouter } = useModelSource(true, provider);

  const subtitle = isOpenRouter ? "Select a model from OpenRouter." : getSubtitle(provider);

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
        <Text color={tokens.muted}>
          {isOpenRouter
            ? "Enter a model ID manually (e.g. openai/gpt-4o):"
            : "Enter a model ID manually:"}
        </Text>
        <Input
          value={value}
          onChange={onChange}
          placeholder={isOpenRouter ? "openai/gpt-4o" : undefined}
          isActive={isActive}
        />
      </Box>
    );
  }

  const models = sourceModels.map(modelInfoToOption);

  if (models.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>{subtitle}</Text>
        <Text dimColor>No models available for this provider.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>{subtitle}</Text>
      <RadioGroup value={value} onChange={onChange} isActive={isActive}>
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
