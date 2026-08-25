import type { LensOption } from "@diffgazer/core/schemas/events";
import type { SelectableLensId } from "@diffgazer/core/schemas/review";
import { Badge } from "@diffgazer/ui/components/badge";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useId, useState } from "react";

interface AnalysisSelectorContentProps {
  options: readonly LensOption[];
  value: SelectableLensId[];
  onChange: (value: SelectableLensId[]) => void;
  disabled?: boolean;
  enabled?: boolean;
  autoFocusList?: boolean;
  required?: boolean;
  invalid?: boolean;
  descriptionId?: string;
  onFocus?: (value: SelectableLensId) => void;
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
  onFocus,
  onBoundaryReached,
}: AnalysisSelectorContentProps) {
  const labelId = useId();
  const [focusedLens, setFocusedLens] = useState<SelectableLensId | null>(
    () => options[0]?.id ?? null,
  );

  const optionIds = options.map((option) => option.id);
  const effectiveFocusedLens =
    focusedLens && optionIds.includes(focusedLens) ? focusedLens : (optionIds[0] ?? null);

  const navigationEnabled = enabled && !disabled && options.length > 0;
  const autoFocusReady = autoFocusList && navigationEnabled;

  const handleChange = (nextValue: string[]) => {
    onChange(
      nextValue.filter((id): id is SelectableLensId =>
        optionIds.some((optionId) => optionId === id),
      ),
    );
  };

  return (
    <div className="space-y-3">
      <SectionHeader as="h2" id={labelId} variant="muted">
        Active Lenses
      </SectionHeader>
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
        keyboardNavigation={navigationEnabled}
        disabled={disabled}
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
            onFocus={() => {
              setFocusedLens(option.id);
              onFocus?.(option.id);
            }}
          />
        ))}
      </CheckboxGroup>
    </div>
  );
}
