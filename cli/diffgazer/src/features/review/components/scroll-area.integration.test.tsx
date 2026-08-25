import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";
import { CodeSnippet } from "./code-snippet";
import { DiffView } from "./diff-view";
import { IssueDetailsPane } from "./issue-details-pane/pane";

const END = "\u001b[F";
const ARROW_DOWN = "\u001b[B";

afterEach(() => {
  cleanup();
});

describe("ScrollArea review compositions", () => {
  test("scrolls multiline rows emitted by an opaque DiffView child", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          <DiffView patch={"--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+tail-marker"} />
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("tail-marker");
    expect(lastFrame()).toContain("\u25BC");

    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("tail-marker");
    expect(lastFrame()).toContain("\u25B2");
  });

  test("scrolls bordered and padded rows emitted by an opaque CodeSnippet child", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          <CodeSnippet
            filePath="src/example.ts"
            lineNumbers={[10, 11, 12]}
            code={"const first = true;\nconst middle = true;\nconst tailMarker = true;"}
          />
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("tailMarker");
    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("tailMarker");
  });

  test("scrolls through IssueDetailsPane into its CodeSnippet evidence rows", async () => {
    const issue = makeIssue({
      evidence: [
        {
          type: "code",
          title: "Measured evidence",
          sourceId: "source:measured",
          file: "src/measured.ts",
          range: { start: 20, end: 22 },
          excerpt:
            "const evidenceStart = true;\nconst evidenceMiddle = true;\nconst evidenceTail = true;",
        },
      ],
    });
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <IssueDetailsPane
          issue={issue}
          activeTab="details"
          isActive
          scrollHeight={3}
          onTabChange={vi.fn()}
          completedSteps={new Set()}
          onToggleStep={vi.fn()}
        />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("evidenceTail");
    for (let step = 0; step < 20 && !lastFrame()?.includes("evidenceTail"); step += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    expect(lastFrame()).toContain("evidenceTail");
  });

  test("scrolls IssueDetailsPane patch rows rendered by DiffView", async () => {
    const issue = makeIssue({
      suggested_patch: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+pane-patch-tail",
    });
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <IssueDetailsPane
          issue={issue}
          activeTab="patch"
          isActive
          scrollHeight={3}
          onTabChange={vi.fn()}
          completedSteps={new Set()}
          onToggleStep={vi.fn()}
        />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("pane-patch-tail");
    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("pane-patch-tail");
  });
});
