import { useRef, useState } from "react";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/schemas/events";
import type { LensId } from "@diffgazer/schemas/review";
import {
  CheckboxGroup,
  CheckboxItem,
  Badge,
  ScrollArea,
} from "@diffgazer/ui";
import { useNavigation } from "keyscope";

const LENS_OPTIONS = (
  Object.entries(LENS_TO_AGENT) as Array<[LensId, keyof typeof AGENT_METADATA]>
).map(([lensId, agentId]) => {
  const meta = AGENT_METADATA[agentId];
  return {
    id: lensId,
    label: meta.name,
    badgeLabel: meta.badgeLabel,
    badgeVariant: meta.badgeVariant as
      | "success"
      | "warning"
      | "error"
      | "info"
      | "neutral",
    description: meta.description,
  };
});

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
  const checkboxRef = useRef<HTMLDivElement>(null);
  const [checkboxFocused, setCheckboxFocused] = useState<string | null>(
    LENS_OPTIONS[0]?.id ?? null,
  );

  const toggleLens = (value: string) => {
    const lensId = value as LensId;
    const newLenses = lenses.includes(lensId)
      ? lenses.filter((l) => l !== lensId)
      : [...lenses, lensId];
    onLensesChange(newLenses);
    return newLenses;
  };

  const handleLensEnter = (value: string) => {
    const nextLenses = toggleLens(value);
    onCommit?.({
      defaultLenses: nextLenses,
    });
  };

  const { focusedValue: checkboxFocusedValue } = useNavigation({
    containerRef: checkboxRef,
    role: "checkbox",
    value: checkboxFocused,
    initialValue: checkboxFocused ?? LENS_OPTIONS[0]?.id ?? null,
    onValueChange: setCheckboxFocused,
    onSelect: toggleLens,
    onEnter: handleLensEnter,
    wrap: false,
    enabled,
    onBoundaryReached,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-mono text-tui-fg/60">Review Agents:</div>
        <ScrollArea className="max-h-[35vh]">
          <CheckboxGroup
            ref={checkboxRef}
            value={lenses}
            onValueChange={onLensesChange}
            focusedValue={enabled ? checkboxFocusedValue : null}
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
