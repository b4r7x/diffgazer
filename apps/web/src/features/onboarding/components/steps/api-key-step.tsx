import { useEffect, useRef, useState } from "react";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/schemas/config";
import { useKey } from "@diffgazer/keyboard";
import type { AIProvider } from "@diffgazer/schemas/config";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import type { FocusElement } from "@/types/focus-element";
import type { InputMethod } from "@/types/input-method";

interface ApiKeyStepProps {
  provider: AIProvider;
  method: InputMethod;
  onMethodChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  onCommit?: (nextValue: { inputMethod: InputMethod; apiKey: string }) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function ApiKeyStep({
  provider,
  method,
  onMethodChange,
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

  useEffect(() => {
    if (method === "env" && focused === "input") {
      setFocused("env");
    }
  }, [focused, method]);

  const focusInput = () => {
    setFocused("input");
    inputRef.current?.focus();
  };

  useKey("ArrowDown", () => {
    if (focused === "paste") {
      if (method === "paste") {
        focusInput();
      } else {
        setFocused("env");
      }
      return;
    }

    if (focused === "input") {
      inputRef.current?.blur();
      setFocused("env");
      return;
    }

    if (focused === "env") {
      onBoundaryReached?.("down");
    }
  }, { enabled, allowInInput: true });

  useKey("ArrowUp", () => {
    if (focused === "env") {
      if (method === "paste") {
        focusInput();
      } else {
        setFocused("paste");
      }
      return;
    }

    if (focused === "input") {
      inputRef.current?.blur();
      setFocused("paste");
    }
  }, { enabled, allowInInput: true });

  useKey(" ", () => {
    if (focused === "paste") {
      onMethodChange("paste");
    } else if (focused === "env") {
      onMethodChange("env");
    }
  }, { enabled });

  useKey("Enter", () => {
    if (focused === "paste") {
      onMethodChange("paste");
      onCommit?.({ inputMethod: "paste", apiKey: keyValue });
    } else if (focused === "env") {
      onMethodChange("env");
      onCommit?.({ inputMethod: "env", apiKey: keyValue });
    } else if (focused === "input") {
      onCommit?.({ inputMethod: method, apiKey: keyValue });
    }
  }, { enabled });

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Provide your API key for {providerName}.
      </p>
      <ApiKeyMethodSelector
        method={method}
        onMethodChange={onMethodChange}
        keyValue={keyValue}
        onKeyValueChange={onKeyValueChange}
        envVarName={envVarName}
        providerName={providerName}
        inputRef={inputRef}
        focused={focused}
        onFocus={setFocused}
        onKeySubmit={() => onCommit?.({ inputMethod: method, apiKey: keyValue })}
      />
    </div>
  );
}
