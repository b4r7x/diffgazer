import type { LensOption } from "@diffgazer/core/schemas/events";
import type { LensId } from "@diffgazer/core/schemas/review";
import { Badge } from "@diffgazer/ui/components/badge";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { useId, useState } from "react";

interface AnalysisSelectorContentProps {
  options: LensOption[];
  value: LensId[];
  onChange: (value: LensId[]) => void;
  disabled?: boolean;
  enabled?: boolean;
  autoFocusList?: boolean;
  required?: boolean;
  invalid?: boolean;
  descriptionId?: string;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function AnalysisSelectorContent({
  options,
  value,
  onChange,
  disabled = false,
  enabled = true,
  autoFocusList = false,
  required = false,
  invalid = false,
  descriptionId,
  onBoundaryReached,
}: AnalysisSelectorContentProps) {
  const labelId = useId();
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
      <div
        id={labelId}
        className="text-xs text-muted-foreground uppercase tracking-wider font-bold"
      >
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
          onNavigationBoundaryReached={(direction) => {
            onBoundaryReached?.(direction === "previous" ? "up" : "down");
          }}
          wrap={false}
          variant="bullet"
          disabled={disabled || !enabled}
          autoFocus={autoFocusReady}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
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
