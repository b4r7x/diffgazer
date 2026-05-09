import { useState, type KeyboardEvent } from "react";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";

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
  const items = EXECUTION_MODES;
  const [highlighted, setHighlighted] = useState<string | null>(value);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === "Enter" && isAgentExecution(highlighted)) {
      e.preventDefault();
      onChange(highlighted);
      onCommit?.(highlighted);
      return;
    }
    if (!onBoundaryReached) return;
    const idx = isAgentExecution(highlighted) ? items.indexOf(highlighted) : -1;
    if (e.key === "ArrowUp" && idx === 0) {
      e.preventDefault();
      onBoundaryReached("up");
    }
    if (e.key === "ArrowDown" && idx === items.length - 1) {
      e.preventDefault();
      onBoundaryReached("down");
    }
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
        onNavigate={(nextValue) => {
          if (isAgentExecution(nextValue)) setHighlighted(nextValue);
        }}
        onKeyDown={handleKeyDown}
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
