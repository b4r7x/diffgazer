import chalk from "chalk";
import {
  type CommandOptions,
  getErrorMessage,
  initializeServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";

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

  const shutdown = createShutdownHandler(
    () => manager.stop(),
    {
      onStart: () => console.log(chalk.yellow("\nShutting down...")),
      onSuccess: () => console.log(chalk.green("Server stopped")),
      onError: (error) => console.error(chalk.red(`Error during shutdown: ${getErrorMessage(error)}`)),
    }
  );

  registerShutdownHandlers(shutdown);

  // Keep process alive until shutdown signal
  await new Promise(() => {});
}
