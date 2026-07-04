import { FooterProvider } from "@diffgazer/core/footer";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewResultsView } from "./results-view";

afterEach(() => {
  cleanup();
});

const ARROW_DOWN = "\u001b[B";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderResults() {
  return render(
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewResultsView
          reviewId="review-1"
          issues={[
            makeIssue({
              id: "issue-1",
              title: "Leaky state update",
              symptom: "Details symptom text",
              rationale: "Explain rationale text",
              recommendation: "Explain recommendation text",
              fixPlan: [
                { step: 1, action: "First fix step" },
                { step: 1, action: "Second fix step" },
                { step: 2, action: "Third fix step" },
              ],
            }),
          ]}
        />
      </CliThemeProvider>
    </FooterProvider>,
  );
}

describe("ReviewResultsView (TUI)", () => {
  test("number keys switch to the matching available issue tab", async () => {
    const { stdin, lastFrame } = renderResults();

    expect(lastFrame() ?? "").toContain("Details symptom text");

    stdin.write("2");
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Explain rationale text");
    expect(frame).toContain("Explain recommendation text");
    expect(frame).not.toContain("Details symptom text");
  });

  test("down arrow moves one fix-plan step when the fix plan is focused", async () => {
    const { stdin, lastFrame } = renderResults();

    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(" ");
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("[ ] 1. First fix step");
    expect(frame).toContain("[x] 1. Second fix step");
    expect(frame).toContain("[ ] 2. Third fix step");
  });
});
