import React from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { useApiServer, type ApiServerState } from "./hooks/use-api-server.js";
import { useWebServer, type WebServerState } from "./hooks/use-web-server.js";
import { Logo } from "./components/logo.js";

function StatusDisplay({
  api,
  web,
}: {
  api: ApiServerState;
  web: WebServerState;
}): React.ReactElement {
  return (
    <>
      {api.status === "starting" && (
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          {" API starting..."}
        </Text>
      )}
      {api.status === "running" && (
        <Text>
          <Text color="green">API: </Text>
          <Text color="blue">{api.address}</Text>
        </Text>
      )}
      {api.status === "error" && <Text color="red">API Error: {api.error}</Text>}

      {web.status === "starting" && (
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          {" Web starting..."}
        </Text>
      )}
      {web.status === "running" && (
        <Text>
          <Text color="green">Web: </Text>
          <Text color="blue">{web.address}</Text>
        </Text>
      )}
      {web.status === "error" && <Text color="red">Web Error: {web.error}</Text>}

      <Text dimColor>Esc to exit</Text>
    </>
  );
}

export function App(): React.ReactElement {
  const { exit } = useApp();
  const api = useApiServer({ onExit: exit });
  const web = useWebServer();

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />
      <Box marginTop={1} flexDirection="column">
        <StatusDisplay api={api} web={web} />
      </Box>
    </Box>
  );
}
