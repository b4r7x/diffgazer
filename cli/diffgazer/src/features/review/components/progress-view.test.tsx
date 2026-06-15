import { FooterProvider } from "@diffgazer/core/footer";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";

import { CliThemeProvider } from "../../../theme/provider";
import { ReviewProgressView, type ReviewProgressViewProps } from "./progress-view";

afterEach(() => {
  cleanup();
});

function renderView(overrides: Partial<ReviewProgressViewProps> = {}) {
  return render(
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewProgressView
          progressSteps={[{ id: "parse", label: "Parse diff", status: "completed" }]}
          agents={[]}
          logEntries={[]}
          fileProgress={{ total: 0, current: 0, currentFile: null, completed: [] }}
          isStreaming
          error={null}
          notices={[]}
          issuesFound={0}
          startedAt={null}
          {...overrides}
        />
      </CliThemeProvider>
    </FooterProvider>,
  );
}

describe("ReviewProgressView (TUI) notices", () => {
  test("renders streamed server notices in the activity pane", () => {
    const { lastFrame } = renderView({
      notices: ["Event stream truncated: showing the first 500 events."],
    });

    expect(lastFrame() ?? "").toContain("Event stream truncated: showing the first 500 events.");
  });
});
