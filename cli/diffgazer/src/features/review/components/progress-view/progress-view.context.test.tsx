import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames, renderRootFrame } from "../../../../testing/render-root-frame";
import { makeContextSnapshot } from "./progress-view.test-harness";
import { ReviewProgressView } from "./view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

describe("ReviewProgressView (TUI) context save", () => {
  test("shows compact saved snapshot feedback inside a completed 80 by 24 frame", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "diffgazer-progress-context-"));
    try {
      const { stdin, lastFrame } = renderRootFrame(
        80,
        24,
        <ReviewProgressView
          progressSteps={[{ id: "report", label: "Build report", status: "completed" }]}
          agents={[]}
          events={[]}
          fileProgress={{ total: 1, current: 1, currentFile: null, completed: ["src/a.ts"] }}
          isStreaming={false}
          error={null}
          notices={[]}
          issuesFound={1}
          startedAt={null}
          completedAt={null}
          contextSnapshot={makeContextSnapshot()}
          contextOutputDirectory={outputDirectory}
        />,
      );

      stdin.write("w");
      await vi.waitFor(() => expect(lastFrame()).toContain("Saved: context.txt"));
      const frame = lastFrame() ?? "";
      expect(frame).toContain("context.md · context.json");
      expect(frame.split("\n")).toHaveLength(24);
      expect(await readFile(join(outputDirectory, "context.txt"), "utf8")).toBe("context");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
