import { useState } from "react";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";

const EXECUTION_MODES: AgentExecution[] = ["sequential", "parallel"];

function isAgentExecution(value: string | null): value is AgentExecution {
  return EXECUTION_MODES.some((mode) => mode === value);
}

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
      <div className="text-sm font-mono text-tui-fg/60">
        Agent Execution Mode:
      </div>
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
  );
}
