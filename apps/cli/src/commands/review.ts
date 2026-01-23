import React from "react";
import { render } from "ink";
import chalk from "chalk";
import { StandaloneReview } from "../features/review/components/standalone-review.js";
import {
  type CommandOptions,
  initializeServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { setBaseUrl } from "../lib/api.js";
import { getErrorMessage } from "@repo/core";

interface ReviewCommandOptions extends CommandOptions {
  staged?: boolean;
  unstaged?: boolean;
}

export async function reviewCommand(options: ReviewCommandOptions): Promise<void> {
  let manager, address;
  try {
    ({ manager, address } = await initializeServer(options));
  } catch (error) {
    console.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    process.exit(1);
  }

  setBaseUrl(address);

  const staged = options.unstaged ? false : true;
  const { waitUntilExit } = render(
    React.createElement(StandaloneReview, { staged })
  );

  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}
