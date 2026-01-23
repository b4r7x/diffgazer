import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface SettingsStatusProps {
  title?: string;
}

export function SettingsLoading({ title = "Stargazer Settings" }: SettingsStatusProps): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{title}</Text>
      <Box marginTop={1}>
        <Spinner type="dots" />
        <Text> Loading settings...</Text>
      </Box>
    </Box>
  );
}

interface SettingsErrorProps {
  title?: string;
  message: string;
  errorDetail?: string;
  actions: string;
}

export function SettingsError({ title = "Stargazer Settings", message, errorDetail, actions }: SettingsErrorProps): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{title}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="red">Error: {message}</Text>
        {errorDetail && (
          <Text color="red" dimColor>({errorDetail})</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{actions}</Text>
      </Box>
    </Box>
  );
}

export function SettingsDeleting({ title = "Stargazer Settings" }: SettingsStatusProps): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{title}</Text>
      <Box marginTop={1}>
        <Spinner type="dots" />
        <Text> Deleting configuration...</Text>
      </Box>
    </Box>
  );
}

export function SettingsDeleteSuccess({ title = "Stargazer Settings" }: SettingsStatusProps): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{title}</Text>
      <Box marginTop={1}>
        <Text color="green">Configuration deleted successfully.</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Returning to setup...</Text>
      </Box>
    </Box>
  );
}
