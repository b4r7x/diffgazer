import { useState, type KeyboardEvent } from "react";
import { buildLensOptions } from "@diffgazer/schemas/events";
import type { LensId } from "@diffgazer/schemas/review";
import { CheckboxGroup, CheckboxItem } from "diffui/components/checkbox";
import { Badge } from "diffui/components/badge";
import { ScrollArea } from "diffui/components/scroll-area";

const LENS_OPTIONS = buildLensOptions();

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
    if (e.key === "Enter" && highlighted) {
      const lensId = highlighted as LensId;
      const newLenses = lenses.includes(lensId)
        ? lenses.filter((l) => l !== lensId)
        : [...lenses, lensId];
      onLensesChange(newLenses);
      onCommit?.({ defaultLenses: newLenses });
      return;
    }
    if (!onBoundaryReached) return;
    const idx = LENS_OPTIONS.findIndex((o) => o.id === highlighted);
    if (e.key === "ArrowUp" && idx === 0) onBoundaryReached("up");
    if (e.key === "ArrowDown" && idx === LENS_OPTIONS.length - 1) onBoundaryReached("down");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-mono text-tui-fg/60">Review Agents:</div>
        <ScrollArea className="max-h-[35vh]">
          <CheckboxGroup
            value={lenses}
            onChange={onLensesChange}
            highlighted={enabled ? highlighted : null}
            onHighlightChange={setHighlighted}
            onKeyDown={handleKeyDown}
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
