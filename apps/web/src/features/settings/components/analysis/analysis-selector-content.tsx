import { useEffect, useMemo, useRef, useState } from "react";
import type { LensId } from "@stargazer/schemas/review";
import { Badge, CheckboxGroup, CheckboxItem, ScrollArea } from "@stargazer/ui";
import { useNavigation } from "@stargazer/keyboard";

export interface AnalysisOption {
  id: LensId;
  label: string;
  badgeLabel: string;
  badgeVariant: "success" | "warning" | "error" | "info" | "neutral";
  description: string;
}

interface AnalysisSelectorContentProps {
  options: AnalysisOption[];
  value: LensId[];
  onChange: (value: LensId[]) => void;
  disabled?: boolean;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function getInitialFocusedLens(options: AnalysisOption[]): LensId | null {
  if (options.length === 0) return null;
  return options[0].id;
}

export function AnalysisSelectorContent({
  options,
  value,
  onChange,
  disabled = false,
  enabled = true,
  onBoundaryReached,
}: AnalysisSelectorContentProps) {
  const checkboxRef = useRef<HTMLDivElement>(null);
  const [focusedLens, setFocusedLens] = useState<LensId | null>(() =>
    getInitialFocusedLens(options),
  );

  const optionIds = useMemo(
    () => options.map((option) => option.id),
    [options],
  );
  const optionIdSet = useMemo(() => new Set(optionIds), [optionIds]);
  const initialFocusedLens = getInitialFocusedLens(options);

  useEffect(() => {
    if (!initialFocusedLens) {
      setFocusedLens(null);
      return;
    }

    if (!focusedLens || !optionIdSet.has(focusedLens)) {
      setFocusedLens(initialFocusedLens);
    }
  }, [focusedLens, initialFocusedLens, optionIdSet]);

  const navigationEnabled = enabled && !disabled && options.length > 0;

  const toggleLens = (rawLensId: string) => {
    const lensId = rawLensId as LensId;
    if (!optionIdSet.has(lensId)) return;
    const nextValue = value.includes(lensId)
      ? value.filter((id) => id !== lensId)
      : [...value, lensId];
    onChange(nextValue);
  };

  const { focusedValue } = useNavigation({
    containerRef: checkboxRef,
    role: "checkbox",
    value: focusedLens,
    onValueChange: (nextValue) => setFocusedLens(nextValue as LensId),
    onSelect: toggleLens,
    onEnter: toggleLens,
    wrap: false,
    enabled: navigationEnabled,
    onBoundaryReached,
    initialValue: initialFocusedLens,
  });

  return (
    <div className="space-y-3">
      <div className="text-xs text-tui-muted uppercase tracking-wider font-bold">
        Active Agents
      </div>
      <ScrollArea className="max-h-90 pr-2">
        <CheckboxGroup
          ref={checkboxRef}
          value={value}
          onValueChange={onChange}
          focusedValue={navigationEnabled ? focusedValue : null}
          variant="bullet"
          disabled={disabled || !enabled}
        >
          {options.map((option) => (
            <CheckboxItem
              key={option.id}
              value={option.id}
              label={
                <span className="flex items-center gap-2">
                  <Badge variant={option.badgeVariant} size="sm">
                    {option.badgeLabel}
                  </Badge>
                  <span>{option.label}</span>
                </span>
              }
              description={option.description}
            />
          ))}
        </CheckboxGroup>
      </ScrollArea>
    </div>
  );
}
