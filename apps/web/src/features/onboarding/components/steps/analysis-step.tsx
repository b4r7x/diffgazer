import { useState, type KeyboardEvent } from "react";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import type { LensId } from "@diffgazer/core/schemas/review";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { Badge } from "@diffgazer/ui/components/badge";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { toVerticalBoundaryDirection } from "@/lib/vertical-navigation";

const LENS_OPTIONS = buildLensOptions();

function isLensId(value: string | null): value is LensId {
  return LENS_OPTIONS.some((option) => option.id === value);
}

interface AnalysisStepProps {
  lenses: LensId[];
  onLensesChange: (lenses: LensId[]) => void;
  onCommit?: (nextValue: {
    defaultLenses: LensId[];
  }) => void;
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
  const [highlighted, setHighlighted] = useState<string | null>(
    LENS_OPTIONS[0]?.id ?? null,
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === "Enter" && isLensId(highlighted)) {
      e.preventDefault();
      const newLenses = lenses.includes(highlighted)
        ? lenses.filter((lens) => lens !== highlighted)
        : [...lenses, highlighted];
      onLensesChange(newLenses);
      onCommit?.({ defaultLenses: newLenses });
      return;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-mono text-tui-fg/60">Review Agents:</div>
        <ScrollArea className="max-h-[35vh]">
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
            className="space-y-1"
          >
            {LENS_OPTIONS.map((option) => (
              <CheckboxItem
                key={option.id}
                value={option.id}
                label={
                  <span className="flex items-center gap-2">
                    {option.label}
                    <Badge
                      variant={option.badgeVariant}
                      size="sm"
                      className="text-[9px]"
                    >
                      {option.badgeLabel}
                    </Badge>
                  </span>
                }
                description={option.description}
              />
            ))}
          </CheckboxGroup>
        </ScrollArea>
      </div>
    </div>
  );
}
