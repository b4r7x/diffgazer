import React from "react";
import { render } from "ink";
import {
  type CommandOptions,
  type ServerManager,
  withServer,
  registerShutdownHandlers,
  createShutdownHandler,
} from "../lib/command-utils.js";
import { setBaseUrl } from "../lib/api.js";
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
  pr?: boolean;
  output?: string;
}

function parseFilesOption(files?: string[]): string[] | undefined {
  if (!files || files.length === 0) {
    return undefined;
  }
  return files.flatMap((f) => f.split(",")).map((f) => f.trim()).filter(Boolean);
}

async function renderWithCleanup(
  element: React.ReactElement,
  manager: ServerManager
): Promise<void> {
  const { waitUntilExit } = render(element);
  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);
  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}

interface PrReviewOptions {
  manager: ServerManager;
  staged: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  outputPath: string;
}

async function runPrReview({
  manager,
  staged,
  files,
  lenses,
  profile,
  outputPath,
}: PrReviewOptions): Promise<void> {
  const { PrReviewApp } = await import("../features/review/apps/pr-review-app.js");
  const shutdown = createShutdownHandler(() => manager.stop());
  registerShutdownHandlers(shutdown);

  let exitCode = 0;
  const onComplete = (code: number): void => {
    exitCode = code;
  };

  const { waitUntilExit } = render(
    React.createElement(PrReviewApp, {
      staged,
      files,
      lenses,
      profile,
      outputPath,
      onComplete,
    })
  );

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
  process.exit(exitCode);
}

export async function reviewCommand(options: ReviewCommandOptions): Promise<void> {
  await withServer(options, async (manager, address) => {
    setBaseUrl(address);

    const staged = options.unstaged ? false : true;
    const files = parseFilesOption(options.files);
    const lenses = options.lens
      ? (options.lens.split(",") as LensId[])
      : undefined;
    const profile = options.profile as ProfileId | undefined;

    if (options.list) {
      const { ReviewHistoryApp } = await import("../features/review/apps/review-history-app.js");
      await renderWithCleanup(React.createElement(ReviewHistoryApp), manager);
      return;
    }

    if (options.resume) {
      const { ReviewResumeApp } = await import("../features/review/apps/review-resume-app.js");
      await renderWithCleanup(
        React.createElement(ReviewResumeApp, { reviewId: options.resume }),
        manager
      );
      return;
    }

    if (options.pick) {
      const { FilePickerApp } = await import("../features/review/apps/file-picker-app.js");
      await renderWithCleanup(
        React.createElement(FilePickerApp, { staged, lenses, profile }),
        manager
      );
      return;
    }

    if (options.pr) {
      const outputPath = options.output ?? "annotations.json";
      await runPrReview({ manager, staged, files, lenses, profile, outputPath });
      return;
    }

    const { InteractiveReviewApp } = await import("../features/review/apps/interactive-review-app.js");
    await renderWithCleanup(
      React.createElement(InteractiveReviewApp, { staged, files, lenses, profile }),
      manager
    );
  });
}
