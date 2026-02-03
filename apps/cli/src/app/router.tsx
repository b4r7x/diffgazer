import React from "react";
import { DevApp } from "./apps/dev-app.js";
import { ProdApp } from "./apps/prod-app.js";
import { CliMode } from "../types/cli.js";

interface AppRouterProps {
  mode: CliMode;
}

export function AppRouter({ mode }: AppRouterProps): React.ReactElement {
  if (mode === "dev") {
    return <DevApp />;
  }

  return <ProdApp />;
}
