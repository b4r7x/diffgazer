import React from "react";
import { render } from "ink";
import chalk from "chalk";
import { App } from "../app/app.js";
import {
  type CommandOptions,
  initializeServer,
  getErrorMessage,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";

export async function runCommand(options: CommandOptions): Promise<void> {
  let manager, address;
  try {
    ({ manager, address } = await initializeServer(options));
  } catch (error) {
    console.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    process.exit(1);
  }

  const { waitUntilExit } = render(React.createElement(App, { address }));

  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}
