import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LensId } from "@diffgazer/core/schemas/review";
import { Badge } from "@diffgazer/ui/components/badge";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { toggleListValue } from "@/lib/selectable-values";

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
  autoFocusList?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function getInitialFocusedLens(options: AnalysisOption[]): LensId | null {
  if (options.length === 0) return null;
  return options[0].id;
}

function getAvailableFocusedLens(value: LensId | null, optionIds: readonly LensId[]): LensId | null {
  if (value && optionIds.includes(value)) return value;
  return optionIds[0] ?? null;
}

export function AnalysisSelectorContent({
  options,
  value,
  onChange,
  disabled = false,
  enabled = true,
  autoFocusList = false,
  onBoundaryReached,
}: AnalysisSelectorContentProps) {
  const [focusedLens, setFocusedLens] = useState<LensId | null>(() =>
    getInitialFocusedLens(options),
  );

  const optionIds = options.map((option) => option.id);
  const effectiveFocusedLens = getAvailableFocusedLens(focusedLens, optionIds);

  const navigationEnabled = enabled && !disabled && options.length > 0;
  const autoFocusReady = autoFocusList && navigationEnabled;

  const handleChange = (nextValue: string[]) => {
    onChange(nextValue.filter((id): id is LensId => optionIds.some((optionId) => optionId === id)));
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!navigationEnabled || !effectiveFocusedLens) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (optionIds.includes(effectiveFocusedLens)) {
        onChange(toggleListValue(value, effectiveFocusedLens));
      }
      return;
    }

    if (onBoundaryReached && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const idx = optionIds.indexOf(effectiveFocusedLens);
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
          onChange={handleChange}
          highlighted={navigationEnabled ? effectiveFocusedLens : null}
          onHighlightChange={(value) => {
            const nextLens = optionIds.find((id) => id === value);
            if (nextLens) setFocusedLens(nextLens);
          }}
          onKeyDown={handleKeyDown}
          wrap={false}
          variant="bullet"
          disabled={disabled || !enabled}
          autoFocus={autoFocusReady}
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
