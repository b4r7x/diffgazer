import chalk from "chalk";
import {
  type CommandOptions,
  initializeServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { getErrorMessage } from "@repo/core";

export async function serveCommand(options: CommandOptions): Promise<void> {
  console.log(chalk.cyan.bold("Stargazer"));
  console.log(chalk.yellow("Starting server..."));

  let manager, address;
  try {
    ({ manager, address } = await initializeServer(options));
  } catch (error) {
    console.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    process.exit(1);
  }

  console.log(chalk.green("Server running"));
  console.log(`Listening on ${chalk.blue(address)}`);
  console.log(chalk.dim("Press Ctrl+C to stop"));

  const shutdown = createShutdownHandler(async () => {
    console.log(chalk.yellow("\nShutting down..."));
    await manager.stop();
    console.log(chalk.green("Server stopped"));
  });

  registerShutdownHandlers(shutdown);

  await new Promise(() => {});
}
