import type { ReactElement } from "react";
import type { LensId } from "@diffgazer/schemas/review";
import { AnalysisSelector } from "../../../settings/components/analysis-selector.js";

interface AnalysisStepProps {
  selectedLenses: LensId[];
  onChange: (lenses: LensId[]) => void;
  isActive?: boolean;
}

export function AnalysisStep({
  selectedLenses,
  onChange,
  isActive = true,
}: AnalysisStepProps): ReactElement {
  return (
    <AnalysisSelector
      selectedLenses={selectedLenses}
      onChange={onChange}
      isActive={isActive}
    />
  );
}
