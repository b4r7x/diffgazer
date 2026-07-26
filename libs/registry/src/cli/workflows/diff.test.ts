import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../terminal.js")>();
  return {
    ...actual,
    info: vi.fn(),
    heading: vi.fn(),
    newline: vi.fn(),
    isSilentMode: () => true,
  };
});

import { info } from "../terminal.js";
import { type DiffWorkflowFile, runDiffWorkflow } from "./diff.js";

describe("runDiffWorkflow", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-diff-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeLocal(relativePath: string, content: string): string {
    const localPath = join(tempDir, relativePath);
    mkdirSync(join(localPath, ".."), { recursive: true });
    writeFileSync(localPath, content);
    return localPath;
  }

  function run(filesByName: Record<string, DiffWorkflowFile[]>): void {
    runDiffWorkflow<null>({
      cwd: tempDir,
      requestedNames: [],
      requireConfig: () => null,
      resolveDefaultNames: () => Object.keys(filesByName),
      validateRequestedNames: () => {},
      resolveFilesForName: ({ name }) => filesByName[name] ?? [],
      noInstalledMessage: "No installed items found.",
      upToDateMessage: "All items are up to date.",
    });
  }

  function infoMessages(): string[] {
    return vi.mocked(info).mock.calls.map(([msg]) => msg);
  }

  // Regression: the counters are incremented per file, so the summary noun must
  // say files — reporting them as items understates how many items were checked.
  it("summarizes the per-file counts with a file noun", () => {
    run({
      button: [
        {
          itemName: "button",
          relativePath: "button.tsx",
          localPath: writeLocal("button.tsx", "edited\n"),
          registryContent: "upstream\n",
        },
        {
          itemName: "button",
          relativePath: "button.css",
          localPath: writeLocal("button.css", "same\n"),
          registryContent: "same\n",
        },
      ],
      spinner: [
        {
          itemName: "spinner",
          relativePath: "spinner.tsx",
          localPath: writeLocal("spinner.tsx", "same\n"),
          registryContent: "same\n",
        },
      ],
    });

    expect(infoMessages()).toContain("Summary: 1 changed, 2 unchanged file(s).");
  });

  it("counts files missing on disk as not installed", () => {
    run({
      button: [
        {
          itemName: "button",
          relativePath: "button.tsx",
          localPath: join(tempDir, "button.tsx"),
          registryContent: "upstream\n",
        },
      ],
    });

    expect(infoMessages()).toContain("Summary: 1 not installed file(s).");
  });

  it("reports the up-to-date message instead of a summary when nothing drifted", () => {
    run({
      button: [
        {
          itemName: "button",
          relativePath: "button.tsx",
          localPath: writeLocal("button.tsx", "same\n"),
          registryContent: "same\n",
        },
      ],
    });

    expect(infoMessages()).toContain("All items are up to date.");
    expect(infoMessages().some((msg) => msg.startsWith("Summary:"))).toBe(false);
  });

  it("reports the empty message when nothing is installed", () => {
    run({});

    expect(infoMessages()).toContain("No installed items found.");
  });
});
