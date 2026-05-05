import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { RadioGroup } from "../../../../components/ui/radio.js";
import { Badge } from "../../../../components/ui/badge.js";
import { Spinner } from "../../../../components/ui/spinner.js";
import { useOpenRouterModels, guardQueryState } from "@diffgazer/core/api/hooks";
import type { ModelInfo, OpenRouterModel } from "@diffgazer/core/schemas/config";
import { GEMINI_MODEL_INFO, GLM_MODEL_INFO } from "@diffgazer/core/schemas/config";

interface ModelStepProps {
  value?: string;
  onChange: (v: string) => void;
  provider: string;
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

function openRouterToOption(model: OpenRouterModel): ModelOption {
  const badges: ModelOption["badges"] = [];
  if (model.isFree) {
    badges.push({ label: "free", variant: "success" });
  }
  return { id: model.id, name: model.name, badges };
}

function getStaticModels(provider: string): ModelOption[] {
  switch (provider) {
    case "gemini":
      return Object.values(GEMINI_MODEL_INFO).map(modelInfoToOption);
    case "zai":
    case "zai-coding":
      return Object.values(GLM_MODEL_INFO).map(modelInfoToOption);
    default:
      return [];
  }
}

export function ModelStep({
  value,
  onChange,
  provider,
  isActive = true,
}: ModelStepProps): ReactElement {
  const isOpenRouter = provider === "openrouter";
  const openRouterQuery = useOpenRouterModels({ enabled: isOpenRouter });

  if (isOpenRouter) {
    const guard = guardQueryState(openRouterQuery, {
      loading: () => <Spinner label="Loading models..." />,
      error: (err) => (
        <Box flexDirection="column" gap={1}>
          <Text color="red">Failed to load models: {err.message}</Text>
        </Box>
      ),
    });
    if (guard) return guard;
  }

  const models: ModelOption[] = isOpenRouter
    ? (openRouterQuery.data?.models ?? []).map(openRouterToOption)
    : getStaticModels(provider);

  if (models.length === 0) {
    return <Text dimColor>No models available for this provider.</Text>;
  }

  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      {models.map((model) => (
        <RadioGroup.Item
          key={model.id}
          value={model.id}
          label={
            <Box gap={1}>
              <Text>{model.name}</Text>
              {model.badges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>
              ))}
            </Box>
          }
        />
      ))}
    </RadioGroup>
  );
}
