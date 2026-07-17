import type { InputMethod } from "@diffgazer/core/onboarding";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import { getVerticalArrowDirection, useKey } from "@diffgazer/keys";
import { type KeyboardEvent, useRef, useState } from "react";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import type { FocusElement } from "@/types/focus-element";

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
  const methodOptionRefs = useRef(new Map<InputMethod, HTMLDivElement>());
  const [focused, setFocused] = useState<FocusElement>("paste");
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const providerName = providerInfo?.name ?? provider;
  const envVarName = PROVIDER_ENV_VARS[provider];
  const effectiveFocused = method === "env" && focused === "input" ? "env" : focused;

  const focusInput = () => {
    setFocused("input");
    inputRef.current?.focus();
  };

  const focusMethodOption = (nextMethod: InputMethod) => {
    setFocused(nextMethod);
    methodOptionRefs.current.get(nextMethod)?.focus();
  };

  const getMethodOptionProps = (nextMethod: InputMethod) => ({
    ref: (node: HTMLDivElement | null) => {
      if (node) methodOptionRefs.current.set(nextMethod, node);
      else methodOptionRefs.current.delete(nextMethod);
    },
  });

  useKey(
    "ArrowDown",
    () => {
      if (effectiveFocused === "paste") {
        if (method === "paste") {
          focusInput();
        } else {
          focusMethodOption("env");
        }
        return;
      }

      if (effectiveFocused === "input") {
        focusMethodOption("env");
        return;
      }

      if (effectiveFocused === "env") {
        onBoundaryReached?.("down");
      }
    },
    { enabled, allowInInput: true },
  );

  useKey(
    "ArrowUp",
    () => {
      if (effectiveFocused === "env") {
        if (method === "paste") {
          focusInput();
        } else {
          focusMethodOption("paste");
        }
        return;
      }

      if (effectiveFocused === "input") {
        focusMethodOption("paste");
      }
    },
    { enabled, allowInInput: true },
  );

  useKey(
    " ",
    () => {
      if (effectiveFocused === "paste") {
        onChange("paste");
      } else if (effectiveFocused === "env") {
        onChange("env");
      }
    },
    { enabled },
  );

  const handleMethodKeyDown = (event: KeyboardEvent, focusedMethod: InputMethod) => {
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
      <p className="text-sm text-muted-foreground font-mono">
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
        onMethodCommit={(inputMethod) => onCommit?.({ inputMethod, apiKey: keyValue })}
        onInputMethodKeyDown={handleMethodKeyDown}
        getMethodOptionProps={getMethodOptionProps}
      />
    </div>
  );
}
