import { buildLensOptions } from "@diffgazer/core/schemas/events";
import { isLensId, type LensId } from "@diffgazer/core/schemas/review";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { type KeyboardEvent, useId, useState } from "react";

const LENS_OPTIONS = buildLensOptions();

interface AnalysisStepProps {
  lenses: LensId[];
  onLensesChange: (lenses: LensId[]) => void;
  onCommit?: (nextValue: { defaultLenses: LensId[] }) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function AnalysisStep({
  lenses,
  onLensesChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: AnalysisStepProps) {
  const labelId = useId();
  const [highlighted, setHighlighted] = useState<string | null>(LENS_OPTIONS[0]?.id ?? null);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.key !== "Enter") return;
    if (!(e.target instanceof HTMLElement)) return;

    const value = e.target.closest<HTMLElement>('[role="checkbox"][data-value]')?.dataset.value;
    if (value === undefined || !isLensId(value)) return;

    e.preventDefault();
    const newLenses = lenses.includes(value)
      ? lenses.filter((lens) => lens !== value)
      : [...lenses, value];
    onLensesChange(newLenses);
    onCommit?.({ defaultLenses: newLenses });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {/* h2: the wizard shell titles each step with an h1, so the default h3 would skip a
            level. */}
        <SectionHeader id={labelId} as="h2" variant="muted">
          Active Lenses
        </SectionHeader>
        <CheckboxGroup
          value={lenses}
          onChange={(nextValue) => {
            onLensesChange(nextValue.filter(isLensId));
          }}
          highlighted={enabled ? highlighted : null}
          onHighlightChange={(nextValue) => {
            if (isLensId(nextValue)) setHighlighted(nextValue);
          }}
          onKeyDown={handleKeyDown}
          keyboardNavigation={enabled}
          autoFocus={enabled}
          onNavigationBoundaryReached={(direction) => {
            onBoundaryReached?.(toVerticalBoundaryDirection(direction));
          }}
          wrap={false}
          aria-labelledby={labelId}
          className="space-y-1"
        >
          {LENS_OPTIONS.map((option) => (
            <CheckboxItem
              key={option.id}
              value={option.id}
              label={
                <span className="flex items-center gap-2">
                  {option.label}
                  <Badge variant={option.badgeVariant} size="sm" className="text-3xs">
                    {option.badgeLabel}
                  </Badge>
                </span>
              }
              description={option.description}
            />
          ))}
        </CheckboxGroup>
      </div>
    </div>
  );
}
