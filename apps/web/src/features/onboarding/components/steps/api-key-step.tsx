import type { OnboardingConfigurationDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { WriteOnlySecretInput } from "@diffgazer/core/schemas/config";
import {
  findNavigationItemByValue,
  getVerticalArrowDirection,
  toVerticalBoundaryDirection,
} from "@diffgazer/keys";
import { Field } from "@diffgazer/ui/components/field";
import { InputGroup } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { type KeyboardEvent, useRef, useState } from "react";

type CredentialMethod = "literal" | "environment";
type CredentialFocus = CredentialMethod | "input";

interface ApiKeyStepProps {
  configurationInput: OnboardingConfigurationDraft;
  onChange: (configurationInput: OnboardingConfigurationDraft) => void;
  onCommit?: () => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function resolveCredentialMethod(credential: WriteOnlySecretInput | undefined): CredentialMethod {
  return credential?.kind === "environment" ? "environment" : "literal";
}

export function ApiKeyStep({
  configurationInput,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ApiKeyStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const methodGroupRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<CredentialFocus>("literal");
  const method = resolveCredentialMethod(configurationInput.credential);
  const secretValue =
    configurationInput.credential?.kind === "literal" ? configurationInput.credential.value : "";

  const setCredential = (credential: WriteOnlySecretInput) => {
    onChange({ ...configurationInput, credential });
  };

  // Focus and the visible highlight are moved together, always from the element
  // the key event actually came from, so the two can never describe different
  // rows.
  const focusMethod = (nextMethod: CredentialMethod) => {
    setFocused(nextMethod);
    findNavigationItemByValue(methodGroupRef.current, {
      type: "radio",
      value: nextMethod,
    })?.focus();
  };

  const focusCredentialInput = () => {
    setFocused("input");
    inputRef.current?.focus();
  };

  const getFocusedMethod = (event: KeyboardEvent): CredentialMethod | null => {
    const item = (event.target as HTMLElement | null)?.closest("[data-value]");
    const value = item?.getAttribute("data-value");
    return value === "literal" || value === "environment" ? value : null;
  };

  // The credential input sits between the two radios, so vertical movement into
  // that gap enters the input instead of skipping to the other radio.
  const handleMethodKeyDown = (event: KeyboardEvent) => {
    const direction = getVerticalArrowDirection(event.key);
    if (direction === null || method !== "literal") return;
    const focusedMethod = getFocusedMethod(event);
    const entersInput =
      (direction === "down" && focusedMethod === "literal") ||
      (direction === "up" && focusedMethod === "environment");
    if (!entersInput) return;
    event.preventDefault();
    focusCredentialInput();
  };

  const handleInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit?.();
      return;
    }
    // Arrows only: the j/k aliases are printable characters that must type into
    // the credential field instead of leaving it.
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    focusMethod(event.key === "ArrowDown" ? "environment" : "literal");
  };

  const product = PRODUCT_REGISTRY[configurationInput.productId];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-mono">
        Provide a write-only credential reference for {product.presentation.name}.
      </p>
      <RadioGroup
        ref={methodGroupRef}
        aria-label="Credential input method"
        value={method}
        onChange={(nextMethod) => {
          if (nextMethod !== "literal" && nextMethod !== "environment") return;
          setFocused(nextMethod);
          setCredential(
            nextMethod === "environment" ? { kind: "environment" } : { kind: "literal", value: "" },
          );
        }}
        highlighted={enabled && focused !== "input" ? focused : null}
        onHighlightChange={(nextMethod) => {
          if (nextMethod === "literal" || nextMethod === "environment") setFocused(nextMethod);
        }}
        onEnter={() => onCommit?.()}
        onKeyDown={handleMethodKeyDown}
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        autoFocus={enabled}
        keyboardNavigation={enabled}
        activationMode="manual"
        wrap={false}
        className="block"
      >
        <div className="space-y-2 mb-4">
          <RadioGroupItem value="literal" label="Enter credential now" />
          <Field className="pl-9" disabled={method !== "literal"}>
            <Field.Label className="sr-only">{product.presentation.name} credential</Field.Label>
            <Field.Control>
              <InputGroup
                ref={inputRef}
                type="password"
                autoComplete="off"
                value={secretValue}
                onChange={(event) => setCredential({ kind: "literal", value: event.target.value })}
                onFocus={() => setFocused("input")}
                onKeyDown={handleInputKeyDown}
                prefix="KEY:"
                aria-label={`${product.presentation.name} credential`}
                className="px-3 py-2"
              />
            </Field.Control>
          </Field>
        </div>
        <RadioGroupItem value="environment" label="Use environment reference" />
      </RadioGroup>
    </div>
  );
}
