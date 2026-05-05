import { useState, type KeyboardEvent } from "react";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";

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
  const items: AgentExecution[] = ["sequential", "parallel"];
  const [highlighted, setHighlighted] = useState<string | null>(value);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && highlighted) {
      const nextMode = highlighted as AgentExecution;
      onChange(nextMode);
      onCommit?.(nextMode);
      return;
    }
    if (!onBoundaryReached) return;
    const idx = items.indexOf(highlighted as AgentExecution);
    if (e.key === "ArrowUp" && idx === 0) onBoundaryReached("up");
    if (e.key === "ArrowDown" && idx === items.length - 1) onBoundaryReached("down");
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-tui-fg/60">
        Agent Execution Mode:
      </div>
      <RadioGroup
        value={value}
        onChange={onChange as (value: string) => void}
        highlighted={enabled ? highlighted : null}
        onHighlightChange={setHighlighted}
        onKeyDown={handleKeyDown}
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
