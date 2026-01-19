import chalk from "chalk";
import React from "react";
import { render } from "ink";
import { App } from "../app/app.js";
import { createServerManager } from "../lib/server.js";
import { parsePort } from "../lib/parse-port.js";

export interface RunOptions {
  port: string;
  hostname?: string;
}

export async function runCommand(options: RunOptions): Promise<void> {
  let port: number;
  try {
    port = parsePort(options.port);
  } catch {
    console.error(chalk.red("Error: Invalid port number"));
    process.exit(1);
  }

  const hostname = options.hostname ?? "localhost";

  const manager = createServerManager({ port, hostname });

  let address: string;
  try {
    const serverAddress = await manager.start();
    address = `http://${serverAddress.hostname}:${serverAddress.port}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error starting server: ${message}`);
    process.exit(1);
  }

  const { waitUntilExit } = render(
    React.createElement(App, {
      address,
      isRunning: true,
    })
  );

  const shutdown = async (): Promise<void> => {
    await manager.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await waitUntilExit();
  await manager.stop();
}
