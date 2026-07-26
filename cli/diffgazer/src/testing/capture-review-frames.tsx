import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "ink";
import type { ReactNode } from "react";
import stripAnsi from "strip-ansi";
import { NavigationProvider } from "../app/providers/navigation";
import { GlobalLayout } from "../components/layout/global";
import { ReviewResultsView } from "../features/review/components/results-view";
import { ReviewSummaryView } from "../features/review/components/summary-view";
import { api } from "../lib/api";
import { CliThemeProvider } from "../theme/provider";
import { TestInput, TestOutput } from "./ink-streams";

const outputDir = process.argv[2];
if (!outputDir) throw new Error("Expected the parity output directory argument");

async function renderFrame(columns: number, child: ReactNode): Promise<string> {
  const stdout = new TestOutput(columns, 24);
  const stderr = new TestOutput(columns, 24);
  const stdin = new TestInput();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const instance = render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <NavigationProvider>
          <FooterProvider initialShortcuts={[]}>
            <CliThemeProvider initialTheme="dark">
              <GlobalLayout>{child}</GlobalLayout>
            </CliThemeProvider>
          </FooterProvider>
        </NavigationProvider>
      </ApiProvider>
    </QueryClientProvider>,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stderr: stderr as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );

  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
  instance.unmount();
  instance.cleanup();
  queryClient.clear();

  const frame = stdout.frames.findLast((value) => stripAnsi(value).trim().length > 0);
  if (!frame) throw new Error(`TUI did not render a ${columns}-column frame`);
  return stripAnsi(frame).replaceAll("\r", "");
}

const fixture = canonicalReviewFixture;
for (const columns of [80, 60] as const) {
  const summary = await renderFrame(
    columns,
    <ReviewSummaryView
      issues={fixture.result.issues}
      reviewId={fixture.metadata.id}
      durationMs={fixture.metadata.durationMs}
      lensStats={fixture.lensStats}
      droppedDuplicates={fixture.droppedDuplicates}
      onContinue={() => undefined}
    />,
  );
  const results = await renderFrame(
    columns,
    <ReviewResultsView
      issues={fixture.result.issues}
      reviewId={fixture.metadata.id}
      droppedDuplicates={fixture.droppedDuplicates}
    />,
  );
  writeFileSync(join(outputDir, `tui-summary-${columns}x24.txt`), summary);
  writeFileSync(join(outputDir, `tui-results-${columns}x24.txt`), results);
}
