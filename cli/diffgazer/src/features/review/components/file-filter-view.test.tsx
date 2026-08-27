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

const contentZone = vi.hoisted(() => ({
  current: { columns: 100, contentColumns: 100, contentRows: 40 },
}));

vi.mock("../../../components/layout/global", () => ({
  getContentZoneRows: (rows: number) => Math.max(rows - 4, 0),
  useContentZone: () => contentZone.current,
}));

import { ReviewFileFilterView, type ReviewFileFilterViewProps } from "./file-filter-view";

const ESCAPE = "\u001b";
const SPACE = " ";
const ARROW_UP = "\u001b[A";
const ARROW_RIGHT = "\u001b[C";
const ENTER = "\r";
const ARROW_DOWN = "\u001b[B";
const TAB = "\t";

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

/** Stands for the pre-run picker, which is handed no mode and picks the scope itself. */
const PICKER_OWNED = "picker-owned" as const;

function renderPicker({
  status,
  mode = "staged",
  reason,
  onStart = vi.fn(),
  onBack = vi.fn(),
}: {
  status: GitStatus;
  mode?: Exclude<ReviewMode, "files"> | typeof PICKER_OWNED;
  reason?: string;
  onStart?: ReviewFileFilterViewProps["onStart"];
  onBack?: () => void;
}) {
  return render(
    <ApiBoundary api={{ getGitStatus: async () => status }}>
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ReviewFileFilterView
            {...(mode === PICKER_OWNED ? {} : { mode })}
            reason={reason}
            onStart={onStart}
            onBack={onBack}
          />
        </FooterProvider>
      </CliThemeProvider>
    </ApiBoundary>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  contentZone.current = { columns: 100, contentColumns: 100, contentRows: 40 };
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
    expect(frameText(lastFrame())).toContain("1 reviewable, none selected");

    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes("1 reviewable, 1 selected"));

    stdin.write("s");
    await waitUntil(() => onStart.mock.calls.length === 1);
    // Every reviewable file is picked, so the run keeps its plain unstaged scope
    // instead of restating it as a files[] list.
    expect(onStart).toHaveBeenCalledWith({ mode: "unstaged" });
  });

  test("gives the actions row back to the list when every row is conflicted", async () => {
    contentZone.current = { columns: 100, contentColumns: 100, contentRows: 9 };
    const { lastFrame } = renderPicker({
      mode: "unstaged",
      status: makeGitStatus({
        unstaged: [
          entry("src/a.ts", "U", "U"),
          entry("src/b.ts", "U", "U"),
          entry("src/c.ts", "U", "U"),
        ],
        conflicted: ["src/a.ts", "src/b.ts", "src/c.ts"],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/c.ts"));
    const frame = frameText(lastFrame());
    expect(frame).not.toContain("Select All");
    expect(frame).not.toContain("▼");
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

    expect(onStart).toHaveBeenCalledWith({ mode: "staged", files: ["src/a.ts", "src/b.ts"] });
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
    expect(onStart).toHaveBeenCalledWith({ mode: "staged" });
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

    // The deselection is recorded, and the notice names how many more must go.
    expect(frameText(lastFrame())).toContain(`${MAX_REVIEW_FILES + 1} selected`);
    expect(frameText(lastFrame())).toContain("Deselect 1 to start.");

    stdin.write("s");
    await flush();
    expect(onStart).not.toHaveBeenCalled();
  });

  test("gives the reason callout its own rows instead of taking them from the frame", async () => {
    const staged = Array.from({ length: 40 }, (_, index) =>
      entry(`src/file-${String(index).padStart(4, "0")}.ts`, "M", " "),
    );
    const status = makeGitStatus({ staged });

    const withoutReason = renderPicker({ status });
    await waitUntil(() => frameText(withoutReason.lastFrame()).includes("src/file-0000.ts"));
    const unreserved = frameText(withoutReason.lastFrame());
    cleanup();

    const withReason = renderPicker({ status, reason: "The change set is large." });
    await waitUntil(() => frameText(withReason.lastFrame()).includes("src/file-0000.ts"));
    const reserved = frameText(withReason.lastFrame());

    expect(reserved).toContain("Narrow the review");
    // The callout's five rows come out of the list, not out of the clipped zone.
    expect(unreserved).toContain("src/file-0031.ts");
    expect(reserved).not.toContain("src/file-0031.ts");
    expect(reserved).toContain("src/file-0026.ts");
  });

  test("opens on the side that has changes when no run picked the scope", async () => {
    const { lastFrame } = renderPicker({
      mode: PICKER_OWNED,
      status: makeGitStatus({ staged: [entry("src/staged.ts", "M", " ")] }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/staged.ts"));
    expect(frameText(lastFrame())).toContain("Select Staged Files");
  });

  test("switches the scope it starts on Tab when it owns the choice", async () => {
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({
      mode: PICKER_OWNED,
      onStart,
      status: makeGitStatus({
        staged: [entry("src/staged.ts", "M", " ")],
        unstaged: [entry("src/worktree.ts", " ", "M")],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/worktree.ts"));
    expect(frameText(lastFrame())).toContain("Select Unstaged Files");

    stdin.write(TAB);
    await waitUntil(() => frameText(lastFrame()).includes("Select Staged Files"));
    expect(frameText(lastFrame())).toContain("src/staged.ts");
    expect(frameText(lastFrame())).not.toContain("src/worktree.ts");

    stdin.write("a");
    await waitUntil(() => frameText(lastFrame()).includes("1 reviewable, 1 selected"));
    stdin.write("s");
    await waitUntil(() => onStart.mock.calls.length === 1);

    expect(onStart).toHaveBeenCalledWith({ mode: "staged" });
  });

  test("keeps the scope the run it was opened from is running", async () => {
    const { lastFrame, stdin } = renderPicker({
      mode: "unstaged",
      status: makeGitStatus({
        staged: [entry("src/staged.ts", "M", " ")],
        unstaged: [entry("src/worktree.ts", " ", "M")],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/worktree.ts"));
    stdin.write(TAB);
    await flush();

    expect(frameText(lastFrame())).toContain("Select Unstaged Files");
    expect(frameText(lastFrame())).not.toContain("src/staged.ts");
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

  test("reaches the actions row past the last file and starts the run from it", async () => {
    const onStart = vi.fn();
    const { lastFrame, stdin } = renderPicker({
      onStart,
      status: makeGitStatus({
        staged: [entry("src/a.ts", "M", " "), entry("src/b.ts", "M", " ")],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));
    const frame = frameText(lastFrame());
    expect(frame).toContain("[ Select All ]");
    expect(frame).toContain("[ None ]");
    expect(frame).toContain("[ Review Selected ]");

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    stdin.write(ENTER);
    await waitUntil(() => frameText(lastFrame()).includes("2 reviewable, 2 selected"));

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write(ENTER);
    await waitUntil(() => onStart.mock.calls.length === 1);

    expect(onStart).toHaveBeenCalledWith({ mode: "staged" });
  });

  test("returns to the file list from the actions row", async () => {
    const { lastFrame, stdin } = renderPicker({
      status: makeGitStatus({
        staged: [entry("src/a.ts", "M", " "), entry("src/b.ts", "M", " ")],
      }),
    });

    await waitUntil(() => frameText(lastFrame()).includes("src/a.ts"));

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();

    stdin.write(SPACE);
    await flush();
    expect(frameText(lastFrame())).toContain("2 reviewable, none selected");

    stdin.write(ARROW_UP);
    await flush();
    stdin.write(SPACE);
    await waitUntil(() => frameText(lastFrame()).includes("2 reviewable, 1 selected"));
  });
});
