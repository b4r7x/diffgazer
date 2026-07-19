import { sanitizeTerminalText } from "@diffgazer/core/review";
import { Text } from "ink";
import type { ReactElement } from "react";
import { useTheme } from "../../theme/provider";
import { Panel } from "../ui/panel";
import { Spinner } from "../ui/spinner";

interface QueryGuardPanels {
  loading: () => ReactElement;
  error: (error: Error) => ReactElement;
}

export function useQueryGuardPanels(loadingLabel: string): QueryGuardPanels {
  const { tokens } = useTheme();

  return {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label={loadingLabel} />
        </Panel.Content>
      </Panel>
    ),
    error: (error) => (
      <Panel>
        <Panel.Content>
          <Text color={tokens.error}>Error: {sanitizeTerminalText(error.message)}</Text>
        </Panel.Content>
      </Panel>
    ),
  };
}
