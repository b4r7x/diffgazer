import { buildLensOptions } from "@diffgazer/core/schemas/events";
import type { LensId } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../ui/badge";
import { CheckboxGroup } from "../ui/checkbox";

const lensOptions = buildLensOptions();

interface AnalysisSelectorProps {
  selectedLenses: LensId[];
  onChange: (lenses: LensId[]) => void;
  isActive?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onDownBoundary?: () => void;
}

export function AnalysisSelector({
  selectedLenses,
  onChange,
  isActive = true,
  disabled = false,
  compact = false,
  onDownBoundary,
}: AnalysisSelectorProps): ReactElement {
  return (
    <CheckboxGroup<LensId>
      value={selectedLenses}
      onChange={onChange}
      isActive={isActive}
      disabled={disabled}
      wrap={!onDownBoundary}
      onNavigationBoundaryReached={(direction) => {
        if (direction === 1) onDownBoundary?.();
      }}
    >
      {lensOptions.map((lens) => (
        <CheckboxGroup.Item
          key={lens.id}
          value={lens.id}
          label={
            <Box gap={1}>
              <Badge variant={lens.badgeVariant}>{lens.badgeLabel}</Badge>
              <Text>{lens.label}</Text>
            </Box>
          }
          description={compact ? undefined : lens.description}
        />
      ))}
    </CheckboxGroup>
  );
}
