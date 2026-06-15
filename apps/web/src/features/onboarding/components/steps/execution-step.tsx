import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useState } from "react";

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
  const [highlighted, setHighlighted] = useState<string | null>(value);

  const handleEnter = (nextValue: string) => {
    if (!isAgentExecution(nextValue)) return;
    onCommit?.(nextValue);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-foreground/60">Agent Execution Mode:</div>
      <RadioGroup
        value={value}
        onChange={(nextValue) => {
          if (isAgentExecution(nextValue)) onChange(nextValue);
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
