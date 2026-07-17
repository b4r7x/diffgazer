import { useModelSource } from "@diffgazer/core/providers";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { resolveAvailableValue } from "../../lib/select";

interface ModelStepProps {
  provider: AIProvider;
  value: string | null;
  onChange: (model: string) => void;
  onCommit?: (model: string) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

interface ModelRadioGroupProps extends Omit<ModelStepProps, "provider"> {
  modelIds: string[];
  children: ReactNode;
  className?: string;
}

function ModelRadioGroup({
  modelIds,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
  children,
  className,
}: ModelRadioGroupProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const effectiveHighlighted = resolveAvailableValue(modelIds, highlighted, value);

  const handleChange = (nextValue: string) => {
    setHighlighted(nextValue);
    onChange(nextValue);
  };

  const handleEnter = (nextValue: string) => {
    setHighlighted(nextValue);
    onCommit?.(nextValue);
  };

  return (
    <RadioGroup
      aria-label="Available models"
      value={value ?? undefined}
      onChange={handleChange}
      highlighted={enabled ? effectiveHighlighted : null}
      onHighlightChange={setHighlighted}
      onEnter={handleEnter}
      onNavigationBoundaryReached={(direction, event) => {
        const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
        if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
      }}
      keyboardNavigation={enabled}
      autoFocus={enabled}
      activationMode="manual"
      wrap={false}
      className={className}
    >
      {children}
    </RadioGroup>
  );
}

interface ModelInfoListProps extends Omit<ModelStepProps, "provider"> {
  subtitle: string;
  models: ModelInfo[];
}

function ModelInfoList({
  subtitle,
  models,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelInfoListProps) {
  const modelIds = models.map((model) => model.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-mono">{subtitle}</p>
      <ModelRadioGroup
        modelIds={modelIds}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        enabled={enabled}
        onBoundaryReached={onBoundaryReached}
        className="space-y-1"
      >
        {models.map((model) => (
          <RadioGroupItem
            key={model.id}
            value={model.id}
            label={
              <span className="flex items-center gap-2">
                {model.name}
                {model.recommended && (
                  <Badge variant="success" size="sm" className="text-3xs">
                    RECOMMENDED
                  </Badge>
                )}
                <Badge
                  variant={model.tier === "free" ? "success" : "neutral"}
                  size="sm"
                  className="text-3xs"
                >
                  {model.tier.toUpperCase()}
                </Badge>
              </span>
            }
            description={model.description}
          />
        ))}
      </ModelRadioGroup>
    </div>
  );
}

export function ModelStep({
  provider,
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ModelStepProps) {
  const { models, loading, error, isOpenRouter, source, fetchedAt, retry } = useModelSource(
    true,
    provider,
  );
  const loadingStateRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const wasLoadingRef = useRef(false);
  const canFocusRecoveryRef = useRef(false);
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  let fallbackNotice: string | null = null;
  if (source === "cache") {
    fallbackNotice = `Using cached catalog data from ${fetchedAt ?? "an unknown time"}.`;
  } else if (source === "snapshot") {
    fallbackNotice = "Using the bundled model catalog because live catalog data is unavailable.";
  }

  useEffect(() => {
    if (!loading) return;

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
  }, [loading]);

  useEffect(() => {
    if (loading || !wasLoadingRef.current) return;

    wasLoadingRef.current = false;
    const isRecovery = Boolean(error) || models.length === 0;
    if (isRecovery && canFocusRecoveryRef.current) retryButtonRef.current?.focus();
    canFocusRecoveryRef.current = false;
  }, [error, loading, models.length]);

  if (loading) {
    return (
      <div ref={loadingStateRef} className="space-y-4">
        <Spinner className="text-muted-foreground">
          {isOpenRouter ? "Loading OpenRouter models..." : "Loading models..."}
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-error-text font-mono">
          Failed to load models: {error}
        </p>
        <Button ref={retryButtonRef} type="button" variant="secondary" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">No models available.</p>
        {fallbackNotice ? (
          <output className="text-sm text-warning-text font-mono">{fallbackNotice}</output>
        ) : null}
        <Button ref={retryButtonRef} type="button" variant="secondary" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  const list = (
    <ModelInfoList
      subtitle={
        isOpenRouter
          ? "Select a model from OpenRouter."
          : `Select a model for ${providerInfo?.name ?? provider}.`
      }
      models={models}
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      enabled={enabled}
      onBoundaryReached={onBoundaryReached}
    />
  );

  const content = isOpenRouter ? (
    <div className="max-h-64 overflow-y-auto scrollbar-hide">{list}</div>
  ) : (
    list
  );

  if (!fallbackNotice) return content;
  return (
    <div className="space-y-3">
      <output className="flex items-center justify-between gap-3 text-sm text-warning-text">
        <span>{fallbackNotice}</span>
        <Button type="button" size="sm" variant="secondary" onClick={retry}>
          Retry
        </Button>
      </output>
      {content}
    </div>
  );
}
