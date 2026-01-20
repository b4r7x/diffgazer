import React from "react";
import { render } from "ink";
import chalk from "chalk";
import { App } from "../app/app.js";
import {
  type CommandOptions,
  initializeServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { setBaseUrl } from "../lib/api.js";
import { getErrorMessage } from "@repo/core";

export async function runCommand(options: CommandOptions): Promise<void> {
  let manager, address;
  try {
    ({ manager, address } = await initializeServer(options));
  } catch (error) {
    console.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    process.exit(1);
  }

  setBaseUrl(address);
  const { waitUntilExit } = render(React.createElement(App, { address }));

  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}
