import React from "react";
import { render } from "ink";
import chalk from "chalk";
import {
  type CommandOptions,
  initializeServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { setBaseUrl } from "../lib/api.js";
import { getErrorMessage } from "@repo/core";
import type { LensId, ProfileId } from "@repo/schemas/lens";

interface ReviewCommandOptions extends CommandOptions {
  staged?: boolean;
  unstaged?: boolean;
  files?: string[];
  lens?: string;
  profile?: string;
  list?: boolean;
  resume?: string;
  pick?: boolean;
}

function parseFilesOption(files?: string[]): string[] | undefined {
  if (!files || files.length === 0) {
    return undefined;
  }
  return files.flatMap((f) => f.split(",")).map((f) => f.trim()).filter(Boolean);
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
  const files = parseFilesOption(options.files);
  const lenses = options.lens
    ? (options.lens.split(",") as LensId[])
    : undefined;
  const profile = options.profile as ProfileId | undefined;

  if (options.list) {
    const { ReviewHistoryApp } = await import("../features/review/apps/review-history-app.js");
    const { waitUntilExit } = render(
      React.createElement(ReviewHistoryApp)
    );

    const shutdown = createShutdownHandler(() => manager.stop());
    registerShutdownHandlers(shutdown);

    await waitUntilExit();
    await manager.stop().catch((err) => console.error("Cleanup error:", err));
    return;
  }

  if (options.resume) {
    const { ReviewResumeApp } = await import("../features/review/apps/review-resume-app.js");
    const { waitUntilExit } = render(
      React.createElement(ReviewResumeApp, { reviewId: options.resume })
    );

    const shutdown = createShutdownHandler(() => manager.stop());
    registerShutdownHandlers(shutdown);

    await waitUntilExit();
    await manager.stop().catch((err) => console.error("Cleanup error:", err));
    return;
  }

  if (options.pick) {
    const { FilePickerApp } = await import("../features/review/apps/file-picker-app.js");
    const { waitUntilExit } = render(
      React.createElement(FilePickerApp, { staged, lenses, profile })
    );

    const shutdown = createShutdownHandler(() => manager.stop());
    registerShutdownHandlers(shutdown);

    await waitUntilExit();
    await manager.stop().catch((err) => console.error("Cleanup error:", err));
    return;
  }

  const { InteractiveReviewApp } = await import("../features/review/apps/interactive-review-app.js");
  const { waitUntilExit } = render(
    React.createElement(InteractiveReviewApp, { staged, files, lenses, profile })
  );

  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}
