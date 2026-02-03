import React from "react";
import { Box } from "ink";
import { Logo } from "../components/ui/logo.js";
import { AppRouter } from "./router.js";
import { CliMode } from "../types/cli.js";

interface AppProps {
  mode: CliMode;
}

export function App({ mode }: AppProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Logo />
      <Box marginTop={1} flexDirection="column">
        <AppRouter mode={mode} />
      </Box>
    </Box>
  );
}
