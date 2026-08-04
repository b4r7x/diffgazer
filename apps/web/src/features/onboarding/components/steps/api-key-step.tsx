import type { OnboardingConfigurationDraft } from "@diffgazer/core/onboarding";
import { type ConfigurationField, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { LocalHttpProductId, WriteOnlySecretInput } from "@diffgazer/core/schemas/config";
import { findNavigationItemByValue, getVerticalArrowDirection } from "@diffgazer/keys";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { Field } from "@diffgazer/ui/components/field";
import { InputGroup } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

type CredentialMethod = "literal" | "environment";
type CredentialFocus = CredentialMethod | "input";

interface ApiKeyStepProps {
  configurationInput: OnboardingConfigurationDraft;
  onChange: (configurationInput: OnboardingConfigurationDraft) => void;
  onCommit?: () => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function getLocalHttpCopy(configurationInput: OnboardingConfigurationDraft): string {
  if (configurationInput.transportFamily !== "local-http") {
    return "Local HTTP setup does not use hosted credentials.";
  }
  return `Configure the local endpoint at ${configurationInput.endpoint} without storing hosted credentials.`;
}

function getLocalCliCopy(configurationInput: OnboardingConfigurationDraft): string {
  if (configurationInput.transportFamily !== "local-cli") {
    return "Local CLI setup does not use hosted credentials.";
  }
  return "Configure the local CLI installation without storing hosted credentials.";
}

function resolveCredentialMethod(credential: WriteOnlySecretInput | undefined): CredentialMethod {
  return credential?.kind === "environment" ? "environment" : "literal";
}

/**
 * Whether the setup plan for this product offers an optional local bearer. The
 * plan's authentication step is built from these configuration fields, so this
 * is the same authority rather than a second opinion about the transport.
 */
function offersLocalBearer(productId: LocalHttpProductId): boolean {
  const configuration: { fields: readonly ConfigurationField[] } =
    PRODUCT_REGISTRY[productId].configuration;
  return configuration.fields.includes("local-authentication");
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
  const localCheckboxRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<CredentialFocus>("literal");
  const isHosted = configurationInput.transportFamily === "hosted-api";
  const method = isHosted ? resolveCredentialMethod(configurationInput.credential) : "literal";
  const secretValue =
    isHosted && configurationInput.credential?.kind === "literal"
      ? configurationInput.credential.value
      : "";

  // The hosted branch enters through RadioGroup autoFocus; the local branches
  // render a bare checkbox or input, so step entry has to focus them here or
  // arrows only reach the wizard footer.
  useEffect(() => {
    if (!enabled) return;
    const target = localCheckboxRef.current ?? localInputRef.current;
    target?.focus();
  }, [enabled]);

  const setCredential = (credential: WriteOnlySecretInput) => {
    if (configurationInput.transportFamily !== "hosted-api") return;
    onChange({ ...configurationInput, credential });
  };

  const setLocalBearerEnabled = (bearerEnabled: boolean) => {
    if (configurationInput.transportFamily !== "local-http") return;
    onChange({
      ...configurationInput,
      authentication: bearerEnabled ? "optional-local-bearer" : "none",
      bearerToken: undefined,
    });
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

  if (configurationInput.transportFamily === "local-http") {
    const bearerEnabled = configurationInput.authentication === "optional-local-bearer";
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          {getLocalHttpCopy(configurationInput)}
        </p>
        {offersLocalBearer(configurationInput.productId) ? (
          <Checkbox
            ref={localCheckboxRef}
            checked={bearerEnabled}
            onChange={setLocalBearerEnabled}
            value="local-bearer"
            label="This server requires a bearer token"
          />
        ) : null}
        {bearerEnabled ? (
          <Field>
            <Field.Label>Bearer token (write-only)</Field.Label>
            <Field.Control>
              <InputGroup
                type="password"
                value={
                  configurationInput.bearerToken?.kind === "literal"
                    ? configurationInput.bearerToken.value
                    : ""
                }
                onChange={(event) =>
                  onChange({
                    ...configurationInput,
                    bearerToken: { kind: "literal", value: event.target.value },
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommit?.();
                  }
                }}
                prefix="TOKEN:"
                aria-label="Local bearer token"
              />
            </Field.Control>
          </Field>
        ) : null}
      </div>
    );
  }

  if (configurationInput.transportFamily === "local-cli") {
    const product = PRODUCT_REGISTRY[configurationInput.productId];
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          {getLocalCliCopy(configurationInput)}
        </p>
        <Field>
          <Field.Label>{product.presentation.name} installation</Field.Label>
          <Field.Control>
            <InputGroup
              ref={localInputRef}
              value={configurationInput.installationId ?? ""}
              onChange={(event) =>
                onChange({
                  ...configurationInput,
                  installationId: event.target.value,
                })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCommit?.();
                }
              }}
              prefix="ID:"
              aria-label={`${product.presentation.name} installation ID`}
            />
          </Field.Control>
        </Field>
      </div>
    );
  }

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
        highlighted={focused === "input" ? null : focused}
        onHighlightChange={(nextMethod) => {
          if (nextMethod === "literal" || nextMethod === "environment") setFocused(nextMethod);
        }}
        onEnter={() => onCommit?.()}
        onKeyDown={handleMethodKeyDown}
        onNavigationBoundaryReached={(direction) => {
          onBoundaryReached?.(direction === "next" ? "down" : "up");
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
