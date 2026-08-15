import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames, renderRootFrame } from "../../../../testing/render-root-frame";
import { flush, makeContextSnapshot, renderView } from "../../testing/progress-view";
import { ReviewProgressView } from "./view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
}));

// renderView does not mount GlobalLayout; derive the content zone from the
// rendered terminal with the real row math. Hoisted here so it registers
// before the render-root-frame import instantiates the app tree.
vi.mock("../../../../components/layout/global", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../components/layout/global")>();
  const { useTerminalDimensions } = await import("../../../../hooks/use-terminal-dimensions");
  return {
    ...actual,
    useContentZone: () => {
      const { columns, rows } = useTerminalDimensions();
      return {
        columns,
        contentRows: actual.getContentZoneRows(rows),
        contentColumns: columns,
      };
    },
  };
});

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

describe("ReviewProgressView (TUI) context save", () => {
  test("shows compact saved snapshot feedback inside a completed 80 by 24 frame", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "diffgazer-progress-context-"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(outputDirectory);
    try {
      const { stdin, lastFrame } = renderRootFrame(
        80,
        24,
        <ReviewProgressView
          progressSteps={[{ id: "report", label: "Build report", status: "completed" }]}
          agents={[]}
          events={[]}
          fileProgress={{ total: 1, completed: ["src/a.ts"] }}
          isStreaming={false}
          error={null}
          notices={[]}
          issuesFound={1}
          startedAt={null}
          completedAt={null}
          contextSnapshot={makeContextSnapshot()}
        />,
      );

      stdin.write("w");
      await vi.waitFor(() => expect(lastFrame()).toContain("Saved: context.txt"));
      const frame = lastFrame() ?? "";
      expect(frame).toContain("context.md · context.json");
      expect(frame.split("\n")).toHaveLength(24);
      expect(await readFile(join(outputDirectory, "context.txt"), "utf8")).toBe("context");
    } finally {
      cwd.mockRestore();
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("shows a context refresh failure with retry guidance instead of hiding the error", async () => {
    const onRetryContextRefresh = vi.fn();
    const { stdin, lastFrame } = renderView({
      isStreaming: false,
      contextRefreshError: "Failed to refresh the review context snapshot.",
      onRetryContextRefresh,
    });

    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Context snapshot unavailable"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Failed to refresh the review");
    expect(frame).toContain("context snapshot.");
    expect(frame).toContain("Press r to retry.");

    stdin.write("r");
    await flush();

    expect(onRetryContextRefresh).toHaveBeenCalledTimes(1);
    expect(lastFrame() ?? "").not.toContain("Context Snapshot");
  });
});
