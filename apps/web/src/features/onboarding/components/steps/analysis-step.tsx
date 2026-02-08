import { useRef, useState } from "react";
import { AGENT_METADATA, LENS_TO_AGENT } from "@stargazer/schemas/events";
import type { LensId } from "@stargazer/schemas/review";
import { CheckboxGroup, CheckboxItem, RadioGroup, RadioGroupItem, Badge, ScrollArea } from "@stargazer/ui";
import { useNavigation } from "@stargazer/keyboard";
import type { AgentExecution } from "@stargazer/schemas/config";

const LENS_OPTIONS = (
  Object.entries(LENS_TO_AGENT) as Array<[LensId, keyof typeof AGENT_METADATA]>
).map(([lensId, agentId]) => {
  const meta = AGENT_METADATA[agentId];
  return {
    id: lensId,
    label: meta.name,
    badgeLabel: meta.badgeLabel,
    badgeVariant: meta.badgeVariant as "success" | "warning" | "error" | "info" | "neutral",
    description: meta.description,
  };
});

interface AnalysisStepProps {
  lenses: LensId[];
  onLensesChange: (lenses: LensId[]) => void;
  agentExecution: AgentExecution;
  onAgentExecutionChange: (mode: AgentExecution) => void;
}

export function AnalysisStep({
  lenses,
  onLensesChange,
  agentExecution,
  onAgentExecutionChange,
}: AnalysisStepProps) {
  const checkboxRef = useRef<HTMLDivElement>(null);
  const radioRef = useRef<HTMLDivElement>(null);
  const [checkboxFocused, setCheckboxFocused] = useState<string | null>(null);

  const toggleLens = (value: string) => {
    const lensId = value as LensId;
    const newLenses = lenses.includes(lensId)
      ? lenses.filter((l) => l !== lensId)
      : [...lenses, lensId];
    onLensesChange(newLenses);
  };

  const { onKeyDown: checkboxKeyDown, focusedValue: checkboxFocusedValue } = useNavigation({
    mode: "local",
    containerRef: checkboxRef,
    role: "checkbox",
    value: checkboxFocused,
    onValueChange: setCheckboxFocused,
    onSelect: toggleLens,
    onEnter: toggleLens,
  });

  const onExecutionChangeStr = onAgentExecutionChange as (value: string) => void;

  const { onKeyDown: radioKeyDown, focusedValue: radioFocusedValue } = useNavigation({
    mode: "local",
    containerRef: radioRef,
    role: "radio",
    value: agentExecution,
    onValueChange: onExecutionChangeStr,
    onSelect: onExecutionChangeStr,
    onEnter: onExecutionChangeStr,
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
            onKeyDown={checkboxKeyDown}
            focusedValue={checkboxFocusedValue}
            className="space-y-1"
          >
            {LENS_OPTIONS.map((option) => (
              <CheckboxItem
                key={option.id}
                value={option.id}
                label={
                  <span className="flex items-center gap-2">
                    {option.label}
                    <Badge variant={option.badgeVariant} size="sm" className="text-[9px]">
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

      <div className="space-y-3">
        <div className="text-sm font-mono text-tui-fg/60">Agent Execution Mode:</div>
        <RadioGroup ref={radioRef} value={agentExecution} onValueChange={onAgentExecutionChange} onKeyDown={radioKeyDown} focusedValue={radioFocusedValue} className="space-y-1">
          <RadioGroupItem
            value="sequential"
            label="Sequential"
            description="Agents run one after another. Works with all providers and tiers."
          />
          <RadioGroupItem
            value="parallel"
            label="Parallel"
            description="All agents run at once. Faster, but may hit rate limits on free tiers."
          />
        </RadioGroup>
      </div>
    </div>
  );
}
