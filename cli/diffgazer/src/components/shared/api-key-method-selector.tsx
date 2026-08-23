import type { InputMethod } from "@diffgazer/core/onboarding";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useTheme } from "../../theme/provider";
import { Input } from "../ui/input";
import { RadioGroup } from "../ui/radio";

interface ApiKeyMethodSelectorProps {
  method: InputMethod;
  onMethodChange: (m: InputMethod) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  envVar: string;
  isActive?: boolean;
  /**
   * Controlled input-focus toggle. When provided, the owner (e.g. the wizard)
   * owns Tab so a single subscriber arbitrates the keystroke.
   */
  inputFocused?: boolean;
  onInputFocusedChange?: (focused: boolean) => void;
}

export function ApiKeyMethodSelector({
  method,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  envVar,
  isActive = true,
  inputFocused: controlledInputFocused,
  onInputFocusedChange,
}: ApiKeyMethodSelectorProps): ReactElement {
  const { tokens } = useTheme();
  const [uncontrolledInputFocused, setUncontrolledInputFocused] = useState(false);
  const isControlled = controlledInputFocused !== undefined;
  const inputFocused = isControlled ? controlledInputFocused : uncontrolledInputFocused;

  useInput(
    (_input, key) => {
      if (key.tab) {
        setUncontrolledInputFocused((f) => !f);
      }
    },
    // When the owner controls input focus it also owns Tab, so the selector
    // must not double-subscribe (Ink delivers to all active subscribers).
    { isActive: isActive && !isControlled },
  );

  function selectMethod(value: InputMethod) {
    if (isControlled) onInputFocusedChange?.(false);
    else setUncontrolledInputFocused(false);
    onMethodChange(value);
  }

  return (
    <Box flexDirection="column" gap={1}>
      <RadioGroup
        value={method}
        onChange={selectMethod}
        onHighlightChange={selectMethod}
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
          <Text color={tokens.muted}>Press Tab to focus input</Text>
        </Box>
      )}

      {method === "env" && (
        <Box flexDirection="column">
          <Text color={tokens.muted}>Environment variable name:</Text>
          <Input value={envVar} placeholder="OPENAI_API_KEY" disabled />
          <Text color={tokens.muted}>Fixed for this provider</Text>
        </Box>
      )}
    </Box>
  );
}
