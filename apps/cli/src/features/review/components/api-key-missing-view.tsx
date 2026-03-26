import { Box } from "ink";
import { Callout } from "../../../components/ui/callout.js";
import { Button } from "../../../components/ui/button.js";
import { Panel } from "../../../components/ui/panel.js";

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
  const title = missingModel ? "Model Required" : "API Key Required";
  const body = missingModel
    ? `No model selected${provider ? ` for ${provider}` : ""}. Set up a model in Settings to start reviewing code.`
    : `No API key configured${provider ? ` for ${provider}` : ""}. Add your API key in Settings to start reviewing code.`;

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
