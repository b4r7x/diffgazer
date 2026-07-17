import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ContextSnapshotPreview } from "./context-snapshot-preview";

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);

function makeSnapshot(root: string): ReviewContextResponse {
  return {
    text: "",
    markdown: "",
    graph: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      root,
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      root,
      statusHash: "hash",
      statusHashKind: "full",
      charCount: 0,
    },
  };
}

describe("ContextSnapshotPreview (TUI)", () => {
  test("strips terminal escape sequences from the derived project name", () => {
    // OSC title-set sequence (ESC ] 0 ; ... BEL) hidden in the repo basename.
    const root = `/home/user/${ESC}]0;HACK${BEL}proj`;

    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSnapshotPreview snapshot={makeSnapshot(root)} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("proj");
    expect(frame).not.toContain("HACK");
  });

  test("renders only the final directory for a Windows-style project root", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSnapshotPreview snapshot={makeSnapshot("C:\\work\\repo")} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Project     : repo");
    expect(frame).not.toContain("C:\\work");
  });

  test.each([
    ["POSIX root", "/", "/"],
    ["Windows drive root", "C:\\", "C:\\"],
    ["Windows share root", "\\\\server\\share\\", "share"],
  ])("retains a useful project label for %s", (_label, root, expectedLabel) => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSnapshotPreview snapshot={makeSnapshot(root)} />
      </CliThemeProvider>,
    );

    expect(lastFrame() ?? "").toContain(`Project     : ${expectedLabel}`);
  });
});
