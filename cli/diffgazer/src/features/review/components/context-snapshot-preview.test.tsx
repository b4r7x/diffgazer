import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const CONTEXT_TEXT = "src/index.ts\nexport const value = 1;";

function makeSnapshot(root: string): ReviewContextResponse {
  return {
    text: CONTEXT_TEXT,
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
      charCount: CONTEXT_TEXT.length,
    },
  };
}

describe("ContextSnapshotPreview (TUI)", () => {
  test("renders context preview lines alongside the snapshot stats", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSnapshotPreview snapshot={makeSnapshot("/home/user/repo")} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain(`Context     : ${CONTEXT_TEXT.length} chars`);
    expect(frame).toContain("export const value = 1;");
  });

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

  test("saves all three snapshot formats to the selected directory", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "diffgazer-context-"));
    const snapshot = makeSnapshot("/home/user/repo");
    snapshot.markdown = "# Context\n\nMarkdown body";
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSnapshotPreview snapshot={snapshot} outputDirectory={outputDirectory} />
      </CliThemeProvider>,
    );

    stdin.write("w");

    await expect.poll(() => lastFrame() ?? "").toContain("Saved context snapshot:");
    const frame = lastFrame() ?? "";
    expect(frame).toContain(join(outputDirectory, "context.txt"));
    expect(frame).toContain(join(outputDirectory, "context.md"));
    expect(frame).toContain(join(outputDirectory, "context.json"));
    await expect(readFile(join(outputDirectory, "context.txt"), "utf8")).resolves.toBe(
      snapshot.text,
    );
    await expect(readFile(join(outputDirectory, "context.md"), "utf8")).resolves.toBe(
      snapshot.markdown,
    );
    await expect(readFile(join(outputDirectory, "context.json"), "utf8")).resolves.toBe(
      `${JSON.stringify(snapshot.graph, null, 2)}\n`,
    );
  });

  test("shows a filesystem diagnostic when the output directory does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "diffgazer-context-reject-"));
    const outputDirectory = join(root, "missing-child");
    try {
      const { lastFrame, stdin } = render(
        <CliThemeProvider initialTheme="dark">
          <ContextSnapshotPreview
            snapshot={makeSnapshot("/home/user/repo")}
            outputDirectory={outputDirectory}
          />
        </CliThemeProvider>,
      );

      stdin.write("w");

      await expect.poll(() => lastFrame() ?? "").toContain("ENOENT");
      expect(lastFrame() ?? "").not.toContain("Saved context snapshot:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
