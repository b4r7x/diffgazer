import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useId, useState } from "react";

interface ExecutionStepProps {
  value: AgentExecution;
  onChange: (value: AgentExecution) => void;
  onCommit?: (value: AgentExecution) => void;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function ExecutionStep({
  value,
  onChange,
  onCommit,
  enabled = true,
  onBoundaryReached,
}: ExecutionStepProps) {
  const labelId = useId();
  const [highlighted, setHighlighted] = useState<string | null>(value);

  const handleEnter = (nextValue: string) => {
    if (!isAgentExecution(nextValue)) return;
    setHighlighted(nextValue);
    onCommit?.(nextValue);
  };

  return (
    <div className="space-y-3">
      {/* h2: the wizard shell titles each step with an h1, so the default h3 would skip a
          level. */}
      <SectionHeader id={labelId} as="h2" variant="muted">
        Agent Execution Mode
      </SectionHeader>
      <RadioGroup
        value={value}
        onChange={(nextValue) => {
          if (!isAgentExecution(nextValue)) return;
          setHighlighted(nextValue);
          onChange(nextValue);
        }}
        highlighted={enabled ? highlighted : null}
        onHighlightChange={(nextValue) => {
          if (isAgentExecution(nextValue)) setHighlighted(nextValue);
        }}
        onEnter={handleEnter}
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        keyboardNavigation={enabled}
        autoFocus={enabled}
        activationMode="manual"
        wrap={false}
        aria-labelledby={labelId}
        className="space-y-1"
      >
        {AGENT_EXECUTION_OPTIONS.map((option) => (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
