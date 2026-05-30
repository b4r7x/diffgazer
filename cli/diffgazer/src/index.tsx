#!/usr/bin/env node

import { getErrorMessage } from "@diffgazer/core/errors";
import { HELP_TEXT, resolveCliAction } from "./cli-options";
import { ensureShutdownToken } from "./lib/shutdown-token";
import { startWeb } from "./web-launcher";

// Replaced at build time by tsup `define`; undefined when run from source (tsx).
declare const __DIFFGAZER_VERSION__: string | undefined;

const VERSION =
  typeof __DIFFGAZER_VERSION__ === "string" ? __DIFFGAZER_VERSION__ : "0.0.0-dev";

async function main(): Promise<void> {
  const action = resolveCliAction(process.argv.slice(2));

  if (action.type === "help") {
    console.log(HELP_TEXT);
    return;
  }

  if (action.type === "version") {
    console.log(VERSION);
    return;
  }

  process.env.DIFFGAZER_CLI_PID = String(process.pid);
  ensureShutdownToken();

  if (action.type === "web") {
    startWeb({ mode: action.mode, openBrowser: action.openBrowser });
    return;
  }

  const { startTui } = await import("./tui-entry");
  await startTui({ mode: action.mode, theme: action.theme });
}

void main().catch((error: unknown) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
