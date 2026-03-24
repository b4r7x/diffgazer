import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { RadioGroup } from "../../../../components/ui/radio.js";
import { Badge } from "../../../../components/ui/badge.js";

interface ModelStepProps {
  value?: string;
  onChange: (v: string) => void;
  provider: string;
  isActive?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  capabilities: Array<{ label: string; variant: "info" | "success" | "warning" }>;
}

const modelsByProvider: Record<string, ModelOption[]> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o", capabilities: [{ label: "fast", variant: "success" }, { label: "vision", variant: "info" }] },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", capabilities: [{ label: "fast", variant: "success" }, { label: "cheap", variant: "warning" }] },
    { id: "o1", name: "o1", capabilities: [{ label: "reasoning", variant: "info" }] },
    { id: "o3-mini", name: "o3-mini", capabilities: [{ label: "reasoning", variant: "info" }, { label: "cheap", variant: "warning" }] },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", capabilities: [{ label: "balanced", variant: "success" }, { label: "vision", variant: "info" }] },
    { id: "claude-haiku-3.5", name: "Claude Haiku 3.5", capabilities: [{ label: "fast", variant: "success" }, { label: "cheap", variant: "warning" }] },
  ],
  openrouter: [
    { id: "openai/gpt-4o", name: "GPT-4o", capabilities: [{ label: "fast", variant: "success" }] },
    { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", capabilities: [{ label: "balanced", variant: "success" }] },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", capabilities: [{ label: "reasoning", variant: "info" }] },
  ],
};

export function ModelStep({
  value,
  onChange,
  provider,
  isActive = true,
}: ModelStepProps): ReactElement {
  const models = modelsByProvider[provider] ?? modelsByProvider["openai"]!;

  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      {models.map((model) => (
        <RadioGroup.Item
          key={model.id}
          value={model.id}
          label={
            <Box gap={1}>
              <Text>{model.name}</Text>
              {model.capabilities.map((cap) => (
                <Badge key={cap.label} variant={cap.variant}>{cap.label}</Badge>
              ))}
            </Box>
          }
        />
      ))}
    </RadioGroup>
  );
}
