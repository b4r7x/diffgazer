import type { ReactElement } from "react";
import { RadioGroup } from "../../../../components/ui/radio.js";

interface ExecutionStepProps {
  value?: string;
  onChange: (v: string) => void;
  isActive?: boolean;
}

export function ExecutionStep({
  value,
  onChange,
  isActive = true,
}: ExecutionStepProps): ReactElement {
  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      <RadioGroup.Item
        value="parallel"
        label="Parallel"
        description="Run agents concurrently (faster, uses more resources)"
      />
      <RadioGroup.Item
        value="sequential"
        label="Sequential"
        description="Run agents one at a time (slower, predictable output)"
      />
    </RadioGroup>
  );
}
