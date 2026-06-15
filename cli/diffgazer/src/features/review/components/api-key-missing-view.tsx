import { getApiKeyMissingCopy } from "@diffgazer/core/review";
import { Box } from "ink";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";

export interface ApiKeyMissingViewProps {
  provider?: string;
  missingModel?: boolean;
  onGoToSettings: () => void;
  onBack: () => void;
}

export function ApiKeyMissingView({
  provider,
  missingModel = false,
  onGoToSettings,
  onBack,
}: ApiKeyMissingViewProps) {
  const { title, body } = getApiKeyMissingCopy({ provider, missingModel });

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <Callout variant="warning">
            <Callout.Title>{title}</Callout.Title>
            <Callout.Content>{body}</Callout.Content>
          </Callout>
          <Box gap={2}>
            <Button variant="primary" isActive onPress={onGoToSettings}>
              Go to Settings
            </Button>
            <Button variant="secondary" onPress={onBack}>
              Back
            </Button>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
