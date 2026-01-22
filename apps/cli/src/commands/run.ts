import React from "react";
import { render } from "ink";
import chalk from "chalk";
import { App, type SessionMode } from "../app/app.js";
import {
  type CommandOptions,
  initializeServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { setBaseUrl } from "../lib/api.js";
import { getErrorMessage } from "@repo/core";

interface RunCommandOptions extends CommandOptions {
  continue?: boolean;
  resume?: string | true;
}

function getSessionMode(options: RunCommandOptions): {
  mode: SessionMode;
  sessionId?: string;
} {
  if (options.continue) return { mode: "continue" };
  if (options.resume === true) return { mode: "picker" };
  if (typeof options.resume === "string")
    return { mode: "resume", sessionId: options.resume };
  return { mode: "new" };
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  let manager, address;
  try {
    ({ manager, address } = await initializeServer(options));
  } catch (error) {
    console.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    process.exit(1);
  }

  setBaseUrl(address);

  const { mode, sessionId } = getSessionMode(options);
  const { waitUntilExit } = render(
    React.createElement(App, { address, sessionMode: mode, sessionId })
  );

  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}
