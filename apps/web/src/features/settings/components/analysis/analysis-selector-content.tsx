import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LensId } from "@diffgazer/schemas/review";
import { Badge } from "diffui/components/badge";
import { CheckboxGroup, CheckboxItem } from "diffui/components/checkbox";
import { ScrollArea } from "diffui/components/scroll-area";

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

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!navigationEnabled || !focusedLens) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (optionIdSet.has(focusedLens)) {
        const nextValue = value.includes(focusedLens)
          ? value.filter((id) => id !== focusedLens)
          : [...value, focusedLens];
        onChange(nextValue);
      }
      return;
    }

    if (onBoundaryReached && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const idx = optionIds.indexOf(focusedLens);
      if (e.key === "ArrowUp" && idx === 0) {
        onBoundaryReached("up");
      } else if (e.key === "ArrowDown" && idx === optionIds.length - 1) {
        onBoundaryReached("down");
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-tui-muted uppercase tracking-wider font-bold">
        Active Agents
      </div>
      <ScrollArea className="max-h-90 pr-2">
        <CheckboxGroup
          value={value}
          onChange={onChange}
          highlighted={navigationEnabled ? focusedLens : null}
          onHighlightChange={(v) => setFocusedLens(v as LensId)}
          onKeyDown={handleKeyDown}
          wrap={false}
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
