import type { ReactElement } from "react";
import { AnalysisSelector } from "../../../settings/components/analysis-selector.js";

interface AnalysisStepProps {
  selectedAgents: string[];
  onChange: (agents: string[]) => void;
  isActive?: boolean;
}

export function AnalysisStep({
  selectedAgents,
  onChange,
  isActive = true,
}: AnalysisStepProps): ReactElement {
  return (
    <AnalysisSelector
      selectedAgents={selectedAgents}
      onChange={onChange}
      isActive={isActive}
    />
  );
}
