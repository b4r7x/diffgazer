import { FooterProvider } from "@diffgazer/core/footer";
import type { GitFileEntry, GitFileStatusCode, GitStatus } from "@diffgazer/core/schemas/git";
import { MAX_REVIEW_FILES, type ReviewMode } from "@diffgazer/core/schemas/review";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiBoundary } from "../../../testing/api-boundary";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText } from "../testing/frame-text";

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => ({ columns: 100, contentColumns: 100, contentRows: 40 }),
}));

import { ReviewFileFilterView } from "./file-filter-view";

const ESCAPE = "\u001b";
const SPACE = " ";
const ARROW_DOWN = "\u001b[B";

function entry(
  path: string,
  indexStatus: GitFileStatusCode,
  workTreeStatus: GitFileStatusCode,
): GitFileEntry {
  return { path, indexStatus, workTreeStatus };
}

function makeGitStatus(overrides: {
  staged?: GitFileEntry[];
  unstaged?: GitFileEntry[];
  untracked?: GitFileEntry[];
  conflicted?: string[];
}): GitStatus {
  return {
    isGitRepo: true,
    branch: "main",
    remoteBranch: null,
    ahead: 0,
    behind: 0,
    files: {
      staged: overrides.staged ?? [],
      unstaged: overrides.unstaged ?? [],
      untracked: overrides.untracked ?? [],
    },
    hasChanges: true,
    conflicted: overrides.conflicted ?? [],
  };
}

function renderPicker({
  status,
  mode = "staged",
  reason,
  onStart = vi.fn(),
  onBack = vi.fn(),
}: {
  status: GitStatus;
  mode?: Exclude<ReviewMode, "files">;
  reason?: string;
  onStart?: (files?: [string, ...string[]]) => void;
  onBack?: () => void;
}) {
  return render(
    <ApiBoundary api={{ getGitStatus: async () => status }}>
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ReviewFileFilterView mode={mode} reason={reason} onStart={onStart} onBack={onBack} />
        </FooterProvider>
      </CliThemeProvider>
    </ApiBoundary>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReviewFileFilterView (TUI)", () => {
  test("offers only the files the selected mode's diff would read", async () => {
    const { lastFrame } = renderPicker({
      mode: "staged",
      status: makeGitStatus({
        staged: [entry("src/staged.ts", "M", " "), entry("src/added.ts", "A", " ")],
        unstaged: [entry("src/worktree-only.ts", " ", "M")],
        untracked: [entry("src/brand-new.ts", "?", "?")],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/staged.ts"));
    const frame = frameText(lastFrame());

    expect(frame).toContain("src/staged.ts");
    expect(frame).toContain("src/added.ts");
    // Each row names what happened to the file, not a bare porcelain letter.
    expect(frame).toContain("modified");
    expect(frame).toContain("added");
    // The staged diff is `git diff --cached`: it never reports a worktree-only
    // change, and git has never seen an untracked file at all.
    expect(frame).not.toContain("src/worktree-only.ts");
    expect(frame).not.toContain("src/brand-new.ts");
  });

  test("shows a conflicted file as unpickable instead of quietly reviewing nothing", async () => {
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({
      mode: "unstaged",
      onStart,
      status: makeGitStatus({
        unstaged: [entry("src/clean.ts", " ", "M"), entry("src/merge.ts", "U", "U")],
        conflicted: ["src/merge.ts"],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/merge.ts"));
    expect(frameText(lastFrame())).toContain("Resolve the conflict first");
    // Only one of the two rows can be picked, so "all" is the clean file alone.
    expect(frameText(lastFrame())).toContain("1 reviewable, none selected");

    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes("1 reviewable, 1 selected"));

    stdin.write("s");
    await waitUntil(() => onStart.mock.calls.length === 1);
    // Every reviewable file is picked, so the run keeps its plain unstaged scope
    // instead of restating it as a files[] list.
    expect(onStart).toHaveBeenCalledWith(undefined);
  });

  test("sends the picked subset and nothing else", async () => {
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({
      onStart,
      status: makeGitStatus({
        staged: [
          entry("src/a.ts", "M", " "),
          entry("src/b.ts", "M", " "),
          entry("src/c.ts", "M", " "),
        ],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));

    stdin.write(SPACE);
    await waitUntil(() => frameText(lastFrame()).includes("3 reviewable, 1 selected"));
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(SPACE);
    await waitUntil(() => frameText(lastFrame()).includes("3 reviewable, 2 selected"));

    stdin.write("s");
    await waitUntil(() => onStart.mock.calls.length === 1);

    expect(onStart).toHaveBeenCalledWith(["src/a.ts", "src/b.ts"]);
  });

  test("clears the selection on n and refuses to start with nothing picked", async () => {
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({
      onStart,
      status: makeGitStatus({ staged: [entry("src/a.ts", "M", " ")] }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));
    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes("1 reviewable, 1 selected"));

    stdin.write("n");
    await waitUntil(() => frameText(lastFrame()).includes("1 reviewable, none selected"));

    stdin.write("s");
    await waitUntil(() => frameText(lastFrame()).includes("none selected"));
    expect(onStart).not.toHaveBeenCalled();
  });

  test("starts the whole mode past the file ceiling, which caps only a named subset", async () => {
    const staged = Array.from({ length: MAX_REVIEW_FILES + 1 }, (_, index) =>
      entry(`src/file-${String(index).padStart(4, "0")}.ts`, "M", " "),
    );
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({ onStart, status: makeGitStatus({ staged }) });

    await waitUntil(() => frameText(lastFrame()).includes("src/file-0000.ts"));

    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes(`${MAX_REVIEW_FILES + 1} selected`));

    stdin.write("s");
    await waitUntil(() => onStart.mock.calls.length > 0);
    expect(onStart).toHaveBeenCalledWith(undefined);
  });

  test("states the file ceiling for a subset the server would refuse", async () => {
    const staged = Array.from({ length: MAX_REVIEW_FILES + 2 }, (_, index) =>
      entry(`src/file-${String(index).padStart(4, "0")}.ts`, "M", " "),
    );
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({ onStart, status: makeGitStatus({ staged }) });

    await waitUntil(() => frameText(lastFrame()).includes("src/file-0000.ts"));

    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes(`${MAX_REVIEW_FILES + 2} selected`));

    // Dropping one file turns the exempt full selection into a subset over the cap.
    stdin.write(" ");
    await waitUntil(() => frameText(lastFrame()).includes(`at most ${MAX_REVIEW_FILES} files`));

    expect(frameText(lastFrame())).toContain(`${MAX_REVIEW_FILES + 2} selected`);
    expect(onStart).not.toHaveBeenCalled();
  });

  test("repeats the failure that sent the user here", async () => {
    const { lastFrame } = renderPicker({
      reason: "This diff does not fit gpt-test. It is 1.20MB across 40 files.",
      status: makeGitStatus({ staged: [entry("src/a.ts", "M", " ")] }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));
    const frame = frameText(lastFrame());

    expect(frame).toContain("Narrow the review");
    expect(frame).toContain("This diff does not fit gpt-test.");
  });

  test("returns to the run it was opened from on Escape", async () => {
    const onBack = vi.fn();
    const { lastFrame, stdin } = renderPicker({
      onBack,
      status: makeGitStatus({ staged: [entry("src/a.ts", "M", " ")] }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));
    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
