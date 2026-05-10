import type { KeyboardEvent, RefCallback, RefObject } from "react";
import { Field } from "@diffgazer/ui/components/field";
import { InputGroup } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { cn } from "@diffgazer/core/cn";
import { getVerticalArrowDirection } from "@diffgazer/keys";
import type { FocusElement } from "@/types/focus-element";
import type { InputMethod } from "@/types/input-method";

interface ApiKeyMethodSelectorProps {
  value: InputMethod;
  onChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  envVarName: string;
  providerName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  focused: FocusElement;
  onFocus: (element: FocusElement) => void;
  onKeySubmit: () => void;
  onInputMethodKeyDown?: (event: KeyboardEvent, method: InputMethod) => void;
  getMethodOptionProps?: (method: InputMethod) => {
    ref: RefCallback<HTMLDivElement>;
  };
}

function isInputMethod(value: string): value is InputMethod {
  return value === "paste" || value === "env";
}

export function ApiKeyMethodSelector({
  value: method,
  onChange,
  keyValue,
  onKeyValueChange,
  envVarName,
  providerName,
  inputRef,
  focused,
  onFocus,
  onKeySubmit,
  onInputMethodKeyDown,
  getMethodOptionProps,
}: ApiKeyMethodSelectorProps) {
  const pasteOptionProps = getMethodOptionProps?.("paste");
  const envOptionProps = getMethodOptionProps?.("env");
  const highlightedMethod = focused === "paste" || focused === "env" ? focused : null;
  const handleMethodChange = (nextMethod: string) => {
    if (!isInputMethod(nextMethod)) return;
    onChange(nextMethod);
    onFocus(nextMethod);
  };

  return (
    <RadioGroup
      aria-label="API key input method"
      value={method}
      onChange={handleMethodChange}
      highlighted={highlightedMethod}
      onHighlightChange={(nextMethod) => {
        if (isInputMethod(nextMethod)) onFocus(nextMethod);
      }}
      onNavigationBoundaryReached={(direction, event) => {
        if (direction === "next" && getVerticalArrowDirection(event.key) === "down") onFocus("cancel");
      }}
      onKeyDown={(event) => {
        if (getVerticalArrowDirection(event.key) !== null && highlightedMethod) {
          onInputMethodKeyDown?.(event, highlightedMethod);
        }
      }}
      activationMode="manual"
      wrap={false}
      className="block"
    >
      <div className="space-y-2 mb-4">
        <RadioGroupItem
          ref={pasteOptionProps?.ref}
          value="paste"
          onFocus={() => {
            onFocus("paste");
          }}
          label="Paste Key Now"
        />
        <Field className="pl-9" disabled={method !== "paste"}>
          <Field.Label className="sr-only">{providerName} API Key</Field.Label>
          <div
            onClick={() => {
              onFocus("input");
              inputRef.current?.focus();
            }}
            className={cn("w-full cursor-text", method !== "paste" && "cursor-not-allowed")}
          >
            <Field.Control>
              <InputGroup
                ref={inputRef}
                type="password"
                value={keyValue}
                onChange={(e) => onKeyValueChange(e.target.value)}
                onFocus={() => onFocus("input")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onKeySubmit();
                  }
                }}
                prefix="KEY:"
                aria-label={`${providerName} API Key`}
                className={cn(
                  "px-3 py-2",
                  method === "paste"
                    ? "bg-tui-input-bg border-tui-blue"
                    : "bg-tui-bg border-tui-border opacity-40",
                  focused === "input" && "ring-2 ring-tui-blue",
                )}
                inputClassName="text-tui-fg tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </Field.Control>
          </div>
        </Field>
      </div>
      <div
        className={cn(
          "space-y-2 transition-opacity",
          method === "env" ? "opacity-100" : "opacity-60 hover:opacity-100"
        )}
      >
        <RadioGroupItem
          ref={envOptionProps?.ref}
          value="env"
          onFocus={() => {
            onFocus("env");
          }}
          label="Import from Env"
        />
        <div className="pl-9">
          <div
            className="flex items-center bg-tui-bg border border-tui-border px-3 py-2 w-full text-tui-muted"
            onClick={() => onFocus("env")}
          >
            <span className="mr-2 select-none text-muted-foreground">$</span>
            <span>{envVarName}</span>
          </div>
        </div>
      </div>
    </RadioGroup>
  );
}
