import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { LensId } from "@diffgazer/core/schemas/review";
import { useTheme } from "../../../../theme/theme-context.js";
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
  const { tokens } = useTheme();
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Review Agents:</Text>
      <AnalysisSelector
        selectedLenses={selectedLenses}
        onChange={onChange}
        isActive={isActive}
      />
    </Box>
  );
}
