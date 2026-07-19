import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import {
  fromSelectedCapabilityIds,
  TRUST_CAPABILITY_OPTIONS,
  TRUST_SECURITY_WARNING,
  toSelectedCapabilityIds,
} from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTheme } from "../../theme/provider";
import { Badge } from "../ui/badge";
import { Callout } from "../ui/callout";
import { CheckboxGroup } from "../ui/checkbox";

interface TrustPermissionsContentProps {
  directory: string;
  value: TrustCapabilities;
  onChange: (value: TrustCapabilities) => void;
  isTrusted?: boolean;
  isActive?: boolean;
  compact?: boolean;
  onDownBoundary?: () => void;
}

export function TrustPermissionsContent({
  directory,
  value,
  onChange,
  isTrusted = false,
  isActive = true,
  compact = false,
  onDownBoundary,
}: TrustPermissionsContentProps): ReactElement {
  const { tokens } = useTheme();
  const selected = toSelectedCapabilityIds(value);

  function handleChange(next: string[]) {
    onChange(fromSelectedCapabilityIds(next));
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection={compact ? "row" : "column"} gap={compact ? 1 : 0}>
        <Text color={tokens.muted}>{compact ? "TARGET" : "TARGET REPOSITORY"}</Text>
        <Box justifyContent="space-between" gap={1} flexGrow={1} overflow="hidden">
          <Text color={tokens.info} bold wrap="truncate-end">
            {directory}
          </Text>
          {isTrusted && <Badge variant="success">TRUSTED</Badge>}
        </Box>
      </Box>

      <CheckboxGroup
        value={selected}
        onChange={handleChange}
        isActive={isActive}
        wrap={!onDownBoundary}
        onNavigationBoundaryReached={(direction) => {
          if (direction === 1) onDownBoundary?.();
        }}
      >
        {TRUST_CAPABILITY_OPTIONS.map(({ id, label, description, disabled }) => (
          <CheckboxGroup.Item
            key={id}
            value={id}
            label={label}
            description={compact ? undefined : description}
            disabled={disabled}
          />
        ))}
      </CheckboxGroup>

      {compact ? (
        <Text color={tokens.warning} wrap="truncate-end">
          {TRUST_SECURITY_WARNING.title}: {TRUST_SECURITY_WARNING.body}
        </Text>
      ) : (
        <Callout variant="warning">
          <Callout.Title>{TRUST_SECURITY_WARNING.title}</Callout.Title>
          <Callout.Content>{TRUST_SECURITY_WARNING.body}</Callout.Content>
        </Callout>
      )}
    </Box>
  );
}
