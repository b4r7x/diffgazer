import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useTheme } from "../../theme/provider";
import { Input } from "../ui/input";
import { RadioGroup } from "../ui/radio";

interface ApiKeyMethodSelectorProps {
  method: "paste" | "env";
  onMethodChange: (m: string) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  envVar: string;
  onEnvVarChange: (v: string) => void;
  isActive?: boolean;
}

export function ApiKeyMethodSelector({
  method,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  envVar,
  onEnvVarChange,
  isActive = true,
}: ApiKeyMethodSelectorProps): ReactElement {
  const { tokens } = useTheme();
  const [inputFocused, setInputFocused] = useState(false);

  useInput(
    (_input, key) => {
      if (key.tab) {
        setInputFocused((f) => !f);
      }
    },
    { isActive },
  );

  function handleMethodChange(value: string) {
    setInputFocused(false);
    onMethodChange(value);
  }

  function handleHighlightChange(value: string) {
    setInputFocused(false);
    onMethodChange(value);
  }

  return (
    <Box flexDirection="column" gap={1}>
      <RadioGroup
        value={method}
        onChange={handleMethodChange}
        onHighlightChange={handleHighlightChange}
        isActive={isActive && !inputFocused}
      >
        <RadioGroup.Item value="paste" label="Paste API key directly" />
        <RadioGroup.Item value="env" label="Use environment variable" />
      </RadioGroup>

      {method === "paste" && (
        <Box flexDirection="column">
          <Text color={tokens.muted}>API Key:</Text>
          <Input
            value={apiKey}
            onChange={onApiKeyChange}
            placeholder="sk-..."
            type="password"
            isActive={isActive && inputFocused}
          />
          <Text color={tokens.muted} dimColor>
            Press Tab to focus input
          </Text>
        </Box>
      )}

      {method === "env" && (
        <Box flexDirection="column">
          <Text color={tokens.muted}>Environment variable name:</Text>
          <Input
            value={envVar}
            onChange={onEnvVarChange}
            placeholder="OPENAI_API_KEY"
            isActive={isActive && inputFocused}
          />
          <Text color={tokens.muted} dimColor>
            Press Tab to focus input
          </Text>
        </Box>
      )}
    </Box>
  );
}
