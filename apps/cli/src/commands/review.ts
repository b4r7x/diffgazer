import React from "react";
import { render } from "ink";
import { withFullScreen } from "fullscreen-ink";
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
  if (!files?.length) return undefined;
  return files.flatMap((f) => f.split(",")).map((f) => f.trim()).filter(Boolean);
}

async function renderWithCleanup(element: React.ReactElement, manager: ServerManager): Promise<void> {
  const ink = withFullScreen(element);
  registerShutdownHandlers(
    createShutdownHandler(async () => {
      ink.instance?.unmount();
      await manager.stop();
    })
  );
  await ink.start();
  await ink.instance?.waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
}

async function runPrReview(
  manager: ServerManager,
  staged: boolean,
  files: string[] | undefined,
  lenses: LensId[] | undefined,
  profile: ProfileId | undefined,
  outputPath: string
): Promise<void> {
  const { PrReviewApp } = await import("../features/review/containers/pr-review-app.js");
  registerShutdownHandlers(createShutdownHandler(() => manager.stop()));

  let exitCode = 0;
  const { waitUntilExit } = render(
    React.createElement(PrReviewApp, {
      staged,
      files,
      lenses,
      profile,
      outputPath,
      onComplete: (code: number) => { exitCode = code; },
    })
  );

  await waitUntilExit();
  await manager.stop().catch((err) => console.error("Cleanup error:", err));
  process.exit(exitCode);
}

export async function reviewCommand(options: ReviewCommandOptions): Promise<void> {
  await withServer(options, async (manager, address) => {
    setBaseUrl(address);

    const staged = !options.unstaged;
    const files = parseFilesOption(options.files);
    const lenses = options.lens?.split(",") as LensId[] | undefined;
    const profile = options.profile as ProfileId | undefined;

    if (options.list) {
      const { ReviewHistoryApp } = await import("../features/review/containers/review-history-app.js");
      return renderWithCleanup(React.createElement(ReviewHistoryApp), manager);
    }

    if (options.resume) {
      const { ReviewResumeApp } = await import("../features/review/containers/review-resume-app.js");
      return renderWithCleanup(React.createElement(ReviewResumeApp, { reviewId: options.resume }), manager);
    }

    if (options.pick) {
      const { FilePickerApp } = await import("../features/review/containers/file-picker-app.js");
      return renderWithCleanup(React.createElement(FilePickerApp, { staged, lenses, profile }), manager);
    }

    if (options.pr) {
      return runPrReview(manager, staged, files, lenses, profile, options.output ?? "annotations.json");
    }

    const { InteractiveReviewApp } = await import("../features/review/containers/interactive-review-app.js");
    return renderWithCleanup(React.createElement(InteractiveReviewApp, { staged, files, lenses, profile }), manager);
  });
}
