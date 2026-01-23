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

  /**
   * Keep the process alive indefinitely until a shutdown signal is received.
   *
   * This promise intentionally never resolves. The process will remain running,
   * allowing the HTTP server to handle requests, until SIGINT/SIGTERM triggers
   * the shutdown handler above. This is a common pattern for long-running CLI
   * servers where we need to prevent the main function from returning while
   * still allowing async cleanup on termination.
   */
  await new Promise(() => {});
}
