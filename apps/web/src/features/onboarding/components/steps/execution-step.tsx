import { useRef, useState } from "react";
import type { AgentExecution } from "@diffgazer/schemas/config";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui";
import { useNavigation } from "keyscope";

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
  const radioRef = useRef<HTMLDivElement>(null);
  const [focusedValue, setFocusedValue] = useState<AgentExecution>(value);

  const handleChange = (nextValue: string) => {
    const nextMode = nextValue as AgentExecution;
    setFocusedValue(nextMode);
    onChange(nextMode);
  };

  const handleCommit = (nextValue: string) => {
    const nextMode = nextValue as AgentExecution;
    handleChange(nextMode);
    onCommit?.(nextMode);
  };

  const { focusedValue: radioFocusedValue } = useNavigation({
    containerRef: radioRef,
    role: "radio",
    value: focusedValue,
    initialValue: focusedValue,
    onValueChange: (nextValue) => setFocusedValue(nextValue as AgentExecution),
    onSelect: handleChange,
    onEnter: handleCommit,
    wrap: false,
    enabled,
    onBoundaryReached,
  });

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-tui-fg/60">
        Agent Execution Mode:
      </div>
      <RadioGroup
        ref={radioRef}
        value={value}
        onValueChange={onChange}
        focusedValue={enabled ? radioFocusedValue : null}
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
