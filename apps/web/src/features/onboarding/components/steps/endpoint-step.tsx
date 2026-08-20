import type { OnboardingConfigurationDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { LocalOpenAIPresetIdSchema } from "@diffgazer/core/schemas/config";
import { findNavigationItemByValue, toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Field } from "@diffgazer/ui/components/field";
import { InputGroup } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useRef, useState } from "react";

interface EndpointStepProps {
  productId: RunnableProductId;
  value: OnboardingConfigurationDraft;
  onChange: (configurationInput: OnboardingConfigurationDraft) => void;
  onCommit?: () => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function EndpointStep({
  productId,
  value: configurationInput,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: EndpointStepProps) {
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<"radio" | "input">("radio");
  const [highlightedEndpoint, setHighlightedEndpoint] = useState<string | null>(null);
  const product = PRODUCT_REGISTRY[productId];

  if (configurationInput.transportFamily === "hosted-api") {
    const workspaceRequired = product.configuration.endpoints.some(
      (endpoint) => "workspaceBound" in endpoint && endpoint.workspaceBound,
    );

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          Choose the endpoint tuple for {product.presentation.name}.
        </p>
        <RadioGroup
          ref={radioGroupRef}
          aria-label="Endpoint profile"
          value={configurationInput.endpoint}
          onChange={(endpoint) => {
            setFocused("radio");
            setHighlightedEndpoint(endpoint);
            const profile = product.configuration.endpoints.find(
              (candidate) => candidate.endpoint === endpoint,
            );
            if (!profile) return;
            onChange({
              ...configurationInput,
              endpoint,
              ...("region" in profile ? { region: profile.region } : {}),
              workspace:
                "workspaceBound" in profile && profile.workspaceBound
                  ? (configurationInput.workspace ?? "")
                  : undefined,
            });
          }}
          highlighted={enabled && focused === "radio" ? highlightedEndpoint : null}
          onHighlightChange={(endpoint) => {
            setFocused("radio");
            setHighlightedEndpoint(endpoint);
          }}
          onEnter={() => onCommit?.()}
          autoFocus={enabled}
          keyboardNavigation={enabled}
          onNavigationBoundaryReached={(direction, event) => {
            const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
            if (verticalDirection === null) return;
            if (verticalDirection === "down" && workspaceRequired) {
              workspaceInputRef.current?.focus();
              return;
            }
            onBoundaryReached?.(verticalDirection);
          }}
          wrap={false}
          className="space-y-1"
        >
          {product.configuration.endpoints.map((endpoint) => (
            <RadioGroupItem
              key={endpoint.id}
              value={endpoint.endpoint}
              label={endpoint.label}
              description={endpoint.endpoint}
              onFocus={() => {
                setFocused("radio");
                setHighlightedEndpoint(endpoint.endpoint);
              }}
            />
          ))}
        </RadioGroup>
        {workspaceRequired ? (
          <Field>
            <Field.Label>Workspace reference</Field.Label>
            <Field.Control>
              <InputGroup
                ref={workspaceInputRef}
                value={configurationInput.workspace ?? ""}
                onChange={(event) =>
                  onChange({ ...configurationInput, workspace: event.target.value })
                }
                onFocus={() => setFocused("input")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommit?.();
                    return;
                  }
                  // Arrows only: the j/k aliases are printable characters that
                  // must type into the workspace field instead of leaving it.
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setFocused("radio");
                    setHighlightedEndpoint(configurationInput.endpoint);
                    findNavigationItemByValue(radioGroupRef.current, {
                      type: "radio",
                      value: configurationInput.endpoint,
                    })?.focus();
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    onBoundaryReached?.("down");
                  }
                }}
                aria-label="Workspace reference"
              />
            </Field.Control>
          </Field>
        ) : null}
      </div>
    );
  }

  if (configurationInput.transportFamily === "local-http") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          Configure the loopback endpoint for {product.presentation.name}.
        </p>
        <RadioGroup
          aria-label="Loopback endpoint"
          value={configurationInput.endpoint}
          onChange={(endpoint) => {
            setHighlightedEndpoint(endpoint);
            const profile = product.configuration.endpoints.find(
              (candidate) => "endpoint" in candidate && candidate.endpoint === endpoint,
            );
            if (!profile || !("endpoint" in profile)) return;
            const nextInput: OnboardingConfigurationDraft = {
              ...configurationInput,
              endpoint: profile.endpoint,
            };
            if (productId !== "local-openai") {
              onChange(nextInput);
              return;
            }
            // The schema that owns this id is the only thing allowed to widen it,
            // so a future third preset fails here rather than in saved config.
            const presetId = LocalOpenAIPresetIdSchema.safeParse(profile.id);
            if (!presetId.success) return;
            onChange({ ...nextInput, presetId: presetId.data });
          }}
          highlighted={enabled ? highlightedEndpoint : null}
          onHighlightChange={setHighlightedEndpoint}
          onEnter={() => onCommit?.()}
          autoFocus={enabled}
          keyboardNavigation={enabled}
          onNavigationBoundaryReached={(direction, event) => {
            const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
            if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
          }}
          wrap={false}
          className="space-y-1"
        >
          {product.configuration.endpoints.map((endpoint) => (
            <RadioGroupItem
              key={endpoint.id}
              value={endpoint.endpoint}
              label={endpoint.label}
              description={endpoint.endpoint}
            />
          ))}
        </RadioGroup>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground font-mono">
      {product.presentation.setupLabel} does not require endpoint binding.
    </p>
  );
}
