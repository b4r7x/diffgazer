import chalk from "chalk";
import { createServerManager } from "../lib/server.js";
import { parsePort } from "../lib/parse-port.js";

export interface ServeOptions {
  port: string;
  hostname?: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  let port: number;
  try {
    port = parsePort(options.port);
  } catch {
    console.error(chalk.red("Error: Invalid port number"));
    process.exit(1);
  }

  const hostname = options.hostname ?? "localhost";
  const manager = createServerManager({ port, hostname });

  console.log(chalk.cyan.bold("Stargazer"));
  console.log(chalk.yellow("Starting server..."));

  try {
    const address = await manager.start();
    console.log(chalk.green("Server running"));
    console.log(
      `Listening on ${chalk.blue(`http://${address.hostname}:${address.port}`)}`
    );
    console.log(chalk.dim("Press Ctrl+C to stop"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }

  const shutdown = async (): Promise<void> => {
    console.log(chalk.yellow("\nShutting down..."));
    try {
      await manager.stop();
      console.log(chalk.green("Server stopped"));
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red(`Error during shutdown: ${message}`));
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  // Keep the process alive indefinitely
  await new Promise(() => {});
}
