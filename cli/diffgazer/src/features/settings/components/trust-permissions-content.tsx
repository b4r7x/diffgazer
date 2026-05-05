import type { ReactElement } from "react";
import { Box } from "ink";
import { CheckboxGroup } from "../../../components/ui/checkbox.js";
import { Callout } from "../../../components/ui/callout.js";

interface Capabilities {
  readFiles: boolean;
  runCommands: boolean;
}

interface TrustPermissionsContentProps {
  capabilities: Capabilities;
  onChange: (caps: Capabilities) => void;
  isActive?: boolean;
}

export function TrustPermissionsContent({
  capabilities,
  onChange,
  isActive = true,
}: TrustPermissionsContentProps): ReactElement {
  const checked: string[] = [];
  if (capabilities.readFiles) checked.push("readFiles");

  function handleChange(values: string[]) {
    onChange({
      readFiles: values.includes("readFiles"),
      runCommands: false,
    });
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Callout variant="warning">
        <Callout.Title>Security Warning</Callout.Title>
        <Callout.Content>
          These permissions allow the AI to access your local files during review.
        </Callout.Content>
      </Callout>

      <CheckboxGroup value={checked} onChange={handleChange} isActive={isActive}>
        <CheckboxGroup.Item
          value="readFiles"
          label="Read files"
          description="Allow reading project files for context"
        />
      </CheckboxGroup>
    </Box>
  );
}
