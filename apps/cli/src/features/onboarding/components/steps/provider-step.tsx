import type { ReactElement } from "react";
import { RadioGroup } from "../../../../components/ui/radio.js";

interface ProviderStepProps {
  value?: string;
  onChange: (v: string) => void;
  isActive?: boolean;
}

export function ProviderStep({
  value,
  onChange,
  isActive = true,
}: ProviderStepProps): ReactElement {
  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      <RadioGroup.Item
        value="openai"
        label="OpenAI"
        description="GPT-4o, GPT-4o-mini, o1, o3-mini"
      />
      <RadioGroup.Item
        value="anthropic"
        label="Anthropic"
        description="Claude Sonnet, Claude Haiku"
      />
      <RadioGroup.Item
        value="openrouter"
        label="OpenRouter"
        description="Access multiple providers via a single API"
      />
    </RadioGroup>
  );
}
