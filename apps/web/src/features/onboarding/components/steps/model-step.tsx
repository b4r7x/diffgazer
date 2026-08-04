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
  /** The persisted draft record discovery addresses; null until the wizard commits one. */
  configuration: SupportedConfigurationSummary | null;
  isPreparing: boolean;
  onRetry: () => void;
  value: string | null;
  onChange: (model: string) => void;
  onCommit?: (model: string) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
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

function DiscoveredModels({
  configuration,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: Omit<ModelStepProps, "configuration" | "isPreparing" | "onRetry"> & {
  configuration: SupportedConfigurationSummary;
}) {
  const loadingStateRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const wasLoadingRef = useRef(false);
  const canFocusRecoveryRef = useRef(false);
  const product = PRODUCT_REGISTRY[configuration.productId];
  const discovery = useModelSource(true, configuration);

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
  configuration,
  isPreparing,
  onRetry,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  if (isPreparing) {
    return (
      <Spinner variant="braille" className="text-muted-foreground" role="status">
        Preparing this configuration for model discovery...
      </Spinner>
    );
  }

  if (!configuration) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          Models are discovered from the saved configuration for this product.
        </p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <DiscoveredModels
      configuration={configuration}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );
}
