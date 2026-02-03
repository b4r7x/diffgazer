import React from "react";
import { CliMode } from "../types/cli.js";
import { ServerProvider } from "./providers/server-provider.js";
import { devServerFactories } from "./modes/dev.js";
import { prodServerFactories } from "./modes/prod.js";
import { StatusScreen } from "./screens/status-screen.js";

interface AppRouterProps {
  mode: CliMode;
}

export function AppRouter({ mode }: AppRouterProps): React.ReactElement {
  const serverFactories =
    mode === "dev" ? devServerFactories : prodServerFactories;

  return (
    <ServerProvider servers={serverFactories}>
      <StatusScreen />
    </ServerProvider>
  );
}
