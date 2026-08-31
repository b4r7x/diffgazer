import type { InputMethod } from "@diffgazer/core/onboarding";
import { getVerticalArrowDirection } from "@diffgazer/keys";
import { Field } from "@diffgazer/ui/components/field";
import { InputGroup } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent, RefCallback, RefObject } from "react";
import { SELECTED_OPTION_ROW } from "@/lib/selected-option-row";
import type { ApiKeyFocusTarget } from "@/types/api-key-focus-target";

const INPUT_METHODS = ["paste", "env"] as const satisfies readonly InputMethod[];

function isInputMethod(value: string): value is InputMethod {
  return (INPUT_METHODS as readonly string[]).includes(value);
}

interface ApiKeyMethodSelectorProps {
  value: InputMethod;
  onChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  envVarName?: string;
  providerName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Null while focus sits outside the credential controls, so no method is highlighted. */
  focused: ApiKeyFocusTarget | null;
  onFocus: (element: ApiKeyFocusTarget) => void;
  onKeySubmit: () => void;
  onMethodCommit: (method: InputMethod) => void;
  onInputMethodKeyDown?: (event: KeyboardEvent, method: InputMethod) => void;
  getMethodOptionProps: (method: InputMethod) => {
    ref: RefCallback<HTMLDivElement>;
  };
  invalid?: boolean;
  errorId?: string;
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
  onMethodCommit,
  onInputMethodKeyDown,
  getMethodOptionProps,
  invalid = false,
  errorId,
}: ApiKeyMethodSelectorProps) {
  const pasteOptionProps = getMethodOptionProps("paste");
  const envOptionProps = getMethodOptionProps("env");
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
      onEnter={onMethodCommit}
      highlighted={highlightedMethod}
      onHighlightChange={(nextMethod) => {
        if (nextMethod !== null && isInputMethod(nextMethod)) onFocus(nextMethod);
      }}
      onNavigationBoundaryReached={(direction, event) => {
        if (direction === "next" && getVerticalArrowDirection(event.key) === "down")
          onFocus("acknowledgement");
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
          ref={pasteOptionProps.ref}
          value="paste"
          onFocus={() => {
            onFocus("paste");
          }}
          label="Paste Key Now"
          className={SELECTED_OPTION_ROW}
        />
        <Field className="pl-9" disabled={method !== "paste"} invalid={invalid}>
          <Field.Label className="sr-only">{providerName} API Key</Field.Label>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only convenience zone that forwards clicks on the padding to the keyboard-accessible InputGroup below; the input itself owns all keyboard interaction. */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users focus the wrapped InputGroup directly, so a duplicate key handler on this padding wrapper would be redundant. */}
          <div
            onMouseDown={(event) => {
              if (method !== "paste") event.preventDefault();
            }}
            onClick={() => {
              if (method !== "paste") return;
              onFocus("input");
              inputRef.current?.focus();
            }}
            className={cn("w-full cursor-text", method !== "paste" && "cursor-not-allowed")}
          >
            <Field.Control>
              <InputGroup
                ref={inputRef}
                type="password"
                autoComplete="off"
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
                aria-describedby={invalid ? errorId : undefined}
                className={cn(
                  "px-3 py-2",
                  method === "paste"
                    ? "bg-input-well border-border"
                    : "bg-background border-border opacity-40",
                )}
                inputClassName="text-foreground tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </Field.Control>
          </div>
        </Field>
      </div>
      <div
        className={cn(
          "space-y-2 transition-opacity",
          method === "env"
            ? "opacity-100"
            : "opacity-60 hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <RadioGroupItem
          ref={envOptionProps.ref}
          value="env"
          onFocus={() => {
            onFocus("env");
          }}
          label="Import from Env"
          className={SELECTED_OPTION_ROW}
        />
        {envVarName ? (
          <div className="pl-9">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-only convenience zone over a readOnly preview input; the keyboard-accessible "Import from Env" radio above owns selection. */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: env selection is reachable via the radio item above, so a key handler on this padding wrapper would be redundant. */}
            <div className="w-full cursor-pointer" onClick={() => onFocus("env")}>
              <InputGroup
                value={envVarName}
                readOnly
                tabIndex={-1}
                prefix="$"
                aria-label={`${envVarName} environment variable`}
                className="bg-background border-border px-3 py-2 text-muted-foreground"
                inputClassName="text-muted-foreground"
              />
            </div>
          </div>
        ) : (
          <p className="pl-9 text-xs text-muted-foreground">
            Uses the provider&apos;s configured environment variable binding.
          </p>
        )}
      </div>
    </RadioGroup>
  );
}
