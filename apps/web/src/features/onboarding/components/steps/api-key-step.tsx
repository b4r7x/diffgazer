import { useRef, useState, type KeyboardEvent } from "react";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import { getVerticalArrowDirection, useKey } from "@diffgazer/keys";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import type { FocusElement } from "@/types/focus-element";
import type { InputMethod } from "@diffgazer/core/onboarding";

interface ApiKeyStepProps {
  provider: AIProvider;
  value: InputMethod;
  onChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  onCommit?: (nextValue: { inputMethod: InputMethod; apiKey: string }) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function ApiKeyStep({
  provider,
  value: method,
  onChange,
  keyValue,
  onKeyValueChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ApiKeyStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<FocusElement>("paste");
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const providerName = providerInfo?.name ?? provider;
  const envVarName = PROVIDER_ENV_VARS[provider];
  const effectiveFocused = method === "env" && focused === "input" ? "env" : focused;

  const focusInput = () => {
    setFocused("input");
    inputRef.current?.focus();
  };

  useKey("ArrowDown", () => {
    if (effectiveFocused === "paste") {
      if (method === "paste") {
        focusInput();
      } else {
        setFocused("env");
      }
      return;
    }

    if (effectiveFocused === "input") {
      inputRef.current?.blur();
      setFocused("env");
      return;
    }

    if (effectiveFocused === "env") {
      onBoundaryReached?.("down");
    }
  }, { enabled, allowInInput: true });

  useKey("ArrowUp", () => {
    if (effectiveFocused === "env") {
      if (method === "paste") {
        focusInput();
      } else {
        setFocused("paste");
      }
      return;
    }

    if (effectiveFocused === "input") {
      inputRef.current?.blur();
      setFocused("paste");
    }
  }, { enabled, allowInInput: true });

  useKey(" ", () => {
    if (effectiveFocused === "paste") {
      onChange("paste");
    } else if (effectiveFocused === "env") {
      onChange("env");
    }
  }, { enabled });

  useKey("Enter", () => {
    if (effectiveFocused === "paste") {
      onChange("paste");
      onCommit?.({ inputMethod: "paste", apiKey: keyValue });
    } else if (effectiveFocused === "env") {
      onChange("env");
      onCommit?.({ inputMethod: "env", apiKey: keyValue });
    } else if (effectiveFocused === "input") {
      onCommit?.({ inputMethod: method, apiKey: keyValue });
    }
  }, { enabled });

  const handleMethodKeyDown = (
    event: KeyboardEvent,
    focusedMethod: InputMethod,
  ) => {
    const direction = getVerticalArrowDirection(event.key);
    if (direction === null) return;

    if (direction === "down" && focusedMethod === "paste" && method === "paste") {
      event.preventDefault();
      focusInput();
      return;
    }

    if (direction === "down" && focusedMethod === "env") {
      event.preventDefault();
      onBoundaryReached?.("down");
      return;
    }

    if (direction === "up" && focusedMethod === "env" && method === "paste") {
      event.preventDefault();
      focusInput();
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Provide your API key for {providerName}.
      </p>
      <ApiKeyMethodSelector
        value={method}
        onChange={onChange}
        keyValue={keyValue}
        onKeyValueChange={onKeyValueChange}
        envVarName={envVarName}
        providerName={providerName}
        inputRef={inputRef}
        focused={effectiveFocused}
        onFocus={setFocused}
        onKeySubmit={() => onCommit?.({ inputMethod: method, apiKey: keyValue })}
        onInputMethodKeyDown={handleMethodKeyDown}
      />
    </div>
  );
}
