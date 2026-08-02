import type { OnboardingConfigurationDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY, useModelSource } from "@diffgazer/core/providers";
import type { ClientConfigurationSummary, ModelInfo } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { useEffect, useRef, useState } from "react";
import { resolveAvailableValue } from "../../lib/select";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

interface ModelStepProps {
  configurationInput: OnboardingConfigurationDraft;
  discoveryConfiguration?: SupportedConfigurationSummary | null;
  value: string | null;
  onChange: (model: string) => void;
  onCommit?: (model: string) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function modelTierFor(
  transportFamily: OnboardingConfigurationDraft["transportFamily"],
): ModelInfo["tier"] {
  return transportFamily === "hosted-api" ? "paid" : "free";
}

function derivePolicyModels(configurationInput: OnboardingConfigurationDraft): ModelInfo[] {
  if (configurationInput.transportFamily === "hosted-api") {
    const policy = PRODUCT_REGISTRY[configurationInput.productId].modelPolicy;
    if (policy.kind === "discovered-allowlist") {
      return policy.modelIds.map((id) => ({
        id,
        name: id,
        description: "",
        tier:
          "higherCostModelIds" in policy &&
          policy.higherCostModelIds?.some((candidate) => candidate === id)
            ? "paid"
            : "free",
        recommended: id === policy.suggestedModelId,
      }));
    }
    if (
      policy.kind === "discovered-exact" &&
      "suggestedModelId" in policy &&
      policy.suggestedModelId
    ) {
      return [
        {
          id: policy.suggestedModelId,
          name: policy.suggestedModelId,
          description: "Exact model required by the selected configuration tuple.",
          tier: modelTierFor(configurationInput.transportFamily),
          recommended: true,
        },
      ];
    }
    if (policy.kind === "pinned-downstream-route") {
      return [
        {
          id: "openrouter/anthropic/claude-3.7-sonnet",
          name: "Pinned downstream route",
          description: "OpenRouter routes to an exact downstream model ID.",
          tier: "paid",
        },
      ];
    }
    return [];
  }

  const policy = PRODUCT_REGISTRY[configurationInput.productId].modelPolicy;
  if (
    policy.kind === "discovered-exact" &&
    "suggestedModelId" in policy &&
    policy.suggestedModelId
  ) {
    const suggestedModelId = String(policy.suggestedModelId);
    return [
      {
        id: suggestedModelId,
        name: suggestedModelId,
        description: "",
        tier: "free",
        recommended: true,
      },
    ];
  }

  return [
    {
      id: configurationInput.transportFamily === "local-cli" ? "gpt-5-codex" : "local-model",
      name: configurationInput.transportFamily === "local-cli" ? "gpt-5-codex" : "local-model",
      description: "Exact model discovered for the configured transport tuple.",
      tier: "free",
    },
  ];
}

function ModelInfoList({
  subtitle,
  models,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: {
  subtitle: string;
  models: ModelInfo[];
  value: string | null;
  onChange: (model: string) => void;
  onCommit?: (model: string) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const effectiveHighlighted = resolveAvailableValue(
    models.map((model) => model.id),
    highlighted,
    value,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-mono">{subtitle}</p>
      <RadioGroup
        aria-label="Available models"
        value={value ?? undefined}
        onChange={(nextValue) => {
          setHighlighted(nextValue);
          onChange(nextValue);
        }}
        highlighted={enabled ? effectiveHighlighted : null}
        onHighlightChange={setHighlighted}
        onEnter={(nextValue) => onCommit?.(nextValue)}
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        keyboardNavigation={enabled}
        autoFocus={enabled}
        activationMode="manual"
        wrap={false}
        className="space-y-1"
      >
        {models.map((model) => (
          <RadioGroupItem
            key={model.id}
            value={model.id}
            label={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {model.name}
                {model.recommended ? (
                  <Badge variant="success" size="sm" className="text-3xs">
                    RECOMMENDED
                  </Badge>
                ) : null}
                <Badge
                  variant={model.tier === "free" ? "success" : "neutral"}
                  size="sm"
                  className="text-3xs"
                >
                  {model.tier.toUpperCase()}
                </Badge>
              </span>
            }
            description={model.description || undefined}
          />
        ))}
      </RadioGroup>
    </div>
  );
}

function PolicyModelStep({
  configurationInput,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: Omit<ModelStepProps, "discoveryConfiguration">) {
  const product = PRODUCT_REGISTRY[configurationInput.productId];
  return (
    <ModelInfoList
      subtitle={`Select an exact model for ${product.presentation.name}.`}
      models={derivePolicyModels(configurationInput)}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}

function DiscoveryModelStep({
  configurationInput,
  discoveryConfiguration,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps & { discoveryConfiguration: SupportedConfigurationSummary }) {
  const loadingStateRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const wasLoadingRef = useRef(false);
  const canFocusRecoveryRef = useRef(false);
  const product = PRODUCT_REGISTRY[configurationInput.productId];
  const discovery = useModelSource(true, discoveryConfiguration);

  useEffect(() => {
    if (discovery.status !== "loading") return;
    wasLoadingRef.current = true;
    canFocusRecoveryRef.current = true;
    const ownerDocument = loadingStateRef.current?.ownerDocument;
    if (!ownerDocument) return;
    const preserveUserFocus = () => {
      canFocusRecoveryRef.current = false;
    };
    ownerDocument.addEventListener("pointerdown", preserveUserFocus, true);
    ownerDocument.addEventListener("focusin", preserveUserFocus, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", preserveUserFocus, true);
      ownerDocument.removeEventListener("focusin", preserveUserFocus, true);
    };
  }, [discovery.status]);

  useEffect(() => {
    if (discovery.status === "loading" || !wasLoadingRef.current) return;
    wasLoadingRef.current = false;
    const isRecovery =
      discovery.status === "error" ||
      discovery.status === "skipped" ||
      (discovery.status === "passed" && discovery.models.length === 0);
    if (isRecovery && canFocusRecoveryRef.current) retryButtonRef.current?.focus();
    canFocusRecoveryRef.current = false;
  }, [discovery.status, discovery.models.length]);

  if (discovery.status === "loading" || discovery.status === "idle") {
    return (
      <div ref={loadingStateRef} className="space-y-4">
        <Spinner variant="braille" className="text-muted-foreground" role="status">
          Discovering models for the configured tuple...
        </Spinner>
      </div>
    );
  }

  if (discovery.status === "error") {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-error-text font-mono">
          {discovery.error}
        </p>
        <Button ref={retryButtonRef} type="button" variant="secondary" onClick={discovery.retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (discovery.status === "skipped") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">{discovery.reason}</p>
        <Button ref={retryButtonRef} type="button" variant="secondary" onClick={discovery.retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (discovery.models.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">No models available.</p>
        <Button ref={retryButtonRef} type="button" variant="secondary" onClick={discovery.retry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <ModelInfoList
      subtitle={`Select an exact model for ${product.presentation.name}.`}
      models={discovery.models}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}

export function ModelStep({
  configurationInput,
  discoveryConfiguration = null,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  if (discoveryConfiguration) {
    return (
      <DiscoveryModelStep
        configurationInput={configurationInput}
        discoveryConfiguration={discoveryConfiguration}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        enabled={enabled}
        onBoundaryReached={onBoundaryReached}
      />
    );
  }

  return (
    <PolicyModelStep
      configurationInput={configurationInput}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}
