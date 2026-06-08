import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import {
  fromSelectedCapabilityIds,
  TRUST_CAPABILITY_OPTIONS,
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
}

export function TrustPermissionsContent({
  directory,
  value,
  onChange,
  isTrusted = false,
  isActive = true,
}: TrustPermissionsContentProps): ReactElement {
  const { tokens } = useTheme();
  const selected = toSelectedCapabilityIds(value);

  function handleChange(next: string[]) {
    onChange(fromSelectedCapabilityIds(next));
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text color={tokens.muted}>TARGET DIRECTORY</Text>
        <Box justifyContent="space-between" gap={1}>
          <Text color={tokens.info} bold>
            {directory}
          </Text>
          {isTrusted && <Badge variant="success">TRUSTED</Badge>}
        </Box>
      </Box>

      <CheckboxGroup value={selected} onChange={handleChange} isActive={isActive}>
        {TRUST_CAPABILITY_OPTIONS.map(({ id, label, description, disabled }) => (
          <CheckboxGroup.Item
            key={id}
            value={id}
            label={label}
            description={description}
            disabled={disabled}
          />
        ))}
      </CheckboxGroup>

      <Callout variant="warning">
        <Callout.Title>SECURITY WARNING</Callout.Title>
        <Callout.Content>
          Run commands is currently unavailable. When enabled, it allows the AI to execute shell
          scripts. This grants significant access to your system.
        </Callout.Content>
      </Callout>
    </Box>
  );
}
