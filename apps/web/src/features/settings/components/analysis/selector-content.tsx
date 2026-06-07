import type { LensId } from "@diffgazer/core/schemas/review";
import { Badge } from "@diffgazer/ui/components/badge";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { useState } from "react";

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

export function AnalysisSelectorContent({
  options,
  value,
  onChange,
  disabled = false,
  enabled = true,
  autoFocusList = false,
  onBoundaryReached,
}: AnalysisSelectorContentProps) {
  const [focusedLens, setFocusedLens] = useState<LensId | null>(() => options[0]?.id ?? null);

  const optionIds = options.map((option) => option.id);
  const effectiveFocusedLens =
    focusedLens && optionIds.includes(focusedLens) ? focusedLens : (optionIds[0] ?? null);

  const navigationEnabled = enabled && !disabled && options.length > 0;
  const autoFocusReady = autoFocusList && navigationEnabled;

  const handleChange = (nextValue: string[]) => {
    onChange(nextValue.filter((id): id is LensId => optionIds.some((optionId) => optionId === id)));
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-tui-muted uppercase tracking-wider font-bold">Active Agents</div>
      <ScrollArea className="max-h-90 pr-2">
        <CheckboxGroup
          value={value}
          onChange={handleChange}
          highlighted={navigationEnabled ? effectiveFocusedLens : null}
          onHighlightChange={(value) => {
            const nextLens = optionIds.find((id) => id === value);
            if (nextLens) setFocusedLens(nextLens);
          }}
          onNavigationBoundaryReached={(direction) => {
            onBoundaryReached?.(direction === "previous" ? "up" : "down");
          }}
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
