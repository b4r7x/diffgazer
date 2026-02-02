import React, { useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { useServer } from "./hooks/use-server.js";
import { createApiServer } from "./lib/api-server.js";
import { createWebServer } from "./lib/web-server.js";
import { type ServerState } from "./lib/create-process-server.js";
import { Logo } from "./components/logo.js";
import { config } from "./config.js";

// Module-level server creation (React recommended pattern for singleton external stores)
const apiServer = createApiServer({
  cwd: config.paths.server,
  port: config.ports.api,
});

const webServer = createWebServer({
  cwd: config.paths.web,
  port: config.ports.web,
});

function ServerStatus({ label, state }: { label: string; state: ServerState }): React.ReactElement | null {
  if (state.status === "starting") {
    return (
      <Text>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        {` ${label} starting...`}
      </Text>
    );
  }
  if (state.status === "running") {
    return (
      <Text>
        <Text color="green">{label}: </Text>
        <Text color="blue">{state.address}</Text>
      </Text>
    );
  }
  if (state.status === "error") {
    return <Text color="red">{label} Error: {state.error}</Text>;
  }
  return null;
}

function StatusDisplay({ api, web }: { api: ServerState; web: ServerState }): React.ReactElement {
  return (
    <>
      <ServerStatus label="API" state={api} />
      <ServerStatus label="Web" state={web} />
      <Text dimColor>Esc to exit</Text>
    </>
  );
}

export function App(): React.ReactElement {
  const { exit } = useApp();
  const api = useServer(apiServer);
  const web = useServer(webServer);

  // Centralized signal handling
  useEffect(() => {
    function handleExit(): void {
      apiServer.stop();
      webServer.stop();
      exit();
      setTimeout(() => process.exit(0), 100);
    }

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    return () => {
      process.off("SIGINT", handleExit);
      process.off("SIGTERM", handleExit);
    };
  }, [exit]);

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
