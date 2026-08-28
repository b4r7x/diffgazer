import { createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { GitFileEntry, GitFileStatusCode, GitStatus } from "@diffgazer/core/schemas/git";
import { MAX_REVIEW_FILES } from "@diffgazer/core/schemas/review";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FilePickerDialog, type FilePickerDialogProps } from "./dialog";

function makeEntry(
  path: string,
  indexStatus: GitFileStatusCode,
  workTreeStatus: GitFileStatusCode,
  previousPath?: string,
): GitFileEntry {
  return { path, indexStatus, workTreeStatus, ...(previousPath ? { previousPath } : {}) };
}

function makeStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    isGitRepo: true,
    branch: "main",
    remoteBranch: null,
    ahead: 0,
    behind: 0,
    hasChanges: true,
    conflicted: [],
    files: { staged: [], unstaged: [], untracked: [] },
    ...overrides,
  };
}

// One of each thing the list has to get right: two ordinary edits, a rename, an
// unresolved conflict the server would drop, and a file git has never seen.
const MIXED_STATUS = makeStatus({
  conflicted: ["src/merge.ts"],
  files: {
    unstaged: [
      makeEntry("src/b.ts", " ", "M"),
      makeEntry("src/a.ts", " ", "M"),
      makeEntry("src/merge.ts", "U", "U"),
    ],
    staged: [
      makeEntry("src/added.ts", "A", " "),
      makeEntry("src/moved.ts", "R", " ", "src/old.ts"),
    ],
    untracked: [makeEntry("src/new.ts", "?", "?")],
  },
});

/** Holds `open` the way home holds it, so a start that never navigates leaves the dialog standing. */
function PickerHarness({
  onOpenChange,
  ...props
}: Omit<FilePickerDialogProps, "open" | "onOpenChange"> &
  Partial<Pick<FilePickerDialogProps, "onOpenChange">>) {
  const [open, setOpen] = useState(true);
  return (
    <FilePickerDialog
      {...props}
      open={open}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}

function renderPicker({
  status = MIXED_STATUS,
  onStart = vi.fn(),
  onOpenChange,
  isStarting = false,
}: {
  /** A function is read per request, so a test can change the tree under an open picker. */
  status?: GitStatus | (() => GitStatus);
  onStart?: FilePickerDialogProps["onStart"];
  onOpenChange?: FilePickerDialogProps["onOpenChange"];
  isStarting?: boolean;
} = {}) {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getGitStatus: vi.fn(async () => (typeof status === "function" ? status() : status)),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <FooterProvider>
          <KeyboardProvider>
            <PickerHarness onStart={onStart} onOpenChange={onOpenChange} isStarting={isStarting} />
          </KeyboardProvider>
        </FooterProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );

  return { ...view, onStart, queryClient };
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "Review Specific Files" });
}

/** Rows carry a status prefix in their name ("modified src/a.ts"), so match on the path. */
async function findRow(path: string): Promise<HTMLElement> {
  return await screen.findByRole("checkbox", { name: (name) => name.includes(path) });
}

function queryRow(path: string): HTMLElement | null {
  return screen.queryByRole("checkbox", { name: (name) => name.includes(path) });
}

/**
 * Waits for the row, then for focus to land on it — two single-level waits, never
 * `waitFor(async () => await findRow(...))`. A findBy* carries its own retry loop, and
 * a waitFor whose callback is still pending skips every tick, so one slow inner attempt
 * spends the whole outer window and reports a bare "Timed out in waitFor." with no
 * assertion behind it.
 */
async function findFocusedRow(path: string): Promise<HTMLElement> {
  const row = await findRow(path);
  await waitFor(() => expect(row).toHaveFocus());
  return row;
}

// Colour contrast is a token contract jsdom cannot compute.
async function expectNoAxeViolations(container: Element) {
  const results = await axeCore.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations).toEqual([]);
}

describe("FilePickerDialog", () => {
  it("lists the files the chosen scope's diff carries, one row each with a status column", async () => {
    renderPicker();

    // The TUI's single-row layout: status as a muted prefix in the label, no
    // second description line eating half the list's height.
    const modified = await findRow("src/a.ts");
    expect(modified).toHaveAccessibleName(/modified\s*src\/a\.ts/);
    expect(modified).not.toHaveAccessibleDescription();
    expect(await findRow("src/b.ts")).toBeInTheDocument();
    // Untracked files are in neither diff, so offering one would review nothing.
    expect(queryRow("src/new.ts")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("radio", { name: "Staged" }));

    expect(await findRow("src/added.ts")).toHaveAccessibleName(/added\s*src\/added\.ts/);
    // A rename keeps its origin on the same row, the TUI's "← old" tail.
    expect(await findRow("src/moved.ts")).toHaveAccessibleName(
      /renamed\s*src\/moved\.ts\s*← src\/old\.ts/,
    );
    expect(queryRow("src/a.ts")).not.toBeInTheDocument();
  });

  it("shows a conflicted file as a dead row that no selection can pick up", async () => {
    const { onStart } = renderPicker();
    const user = userEvent.setup();

    const conflicted = await findRow("src/merge.ts");
    expect(conflicted).toHaveAttribute("aria-disabled", "true");
    expect(conflicted).toHaveAccessibleDescription(
      "Resolve the conflict first — reviews skip conflicted files.",
    );
    expect(conflicted).toHaveAttribute("aria-checked", "false");

    // Two reviewable files, not three: the conflicted row is outside the count,
    // outside Select All, and outside the start.
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear All" }));
    await user.click(screen.getByRole("button", { name: "Select All" }));
    expect(conflicted).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByRole("button", { name: "Review 2 Files" }));
    expect(onStart).toHaveBeenCalledWith({ mode: "unstaged", files: undefined });
  });

  it("sends the picked subset and nothing more", async () => {
    const { onStart } = renderPicker();
    const user = userEvent.setup();

    await user.click(await findRow("src/a.ts"));
    await user.click(screen.getByRole("button", { name: "Review 1 File" }));

    expect(onStart).toHaveBeenCalledWith({ mode: "unstaged", files: ["src/b.ts"] });
  });

  // 202 real checkbox rows and pointer-event clicks through them are slow under
  // a fully loaded turbo run; the default 30s occasionally times out.
  it(
    "refuses a subset past the server's file cap but exempts the full selection",
    { timeout: 90_000 },
    async () => {
      const paths = Array.from({ length: MAX_REVIEW_FILES + 2 }, (_, index) =>
        makeEntry(`src/file-${String(index).padStart(4, "0")}.ts`, " ", "M"),
      );
      renderPicker({
        status: makeStatus({ files: { staged: [], unstaged: paths, untracked: [] } }),
      });
      const user = userEvent.setup();

      await findRow("src/file-0000.ts");
      // The untouched full selection starts with no files[] at all, which the
      // server does not cap — it must stay startable however long the list is.
      const start = screen.getByRole("button", { name: /^Review \d+ Files$/ });
      expect(start).toBeEnabled();

      // Deselecting one file turns it into a files[] subset, and 201 > 200.
      await user.click(await findRow("src/file-0000.ts"));
      await waitFor(() => expect(start).toBeDisabled());
      expect(
        within(dialog()).getByText(
          `A review reads at most ${MAX_REVIEW_FILES} files. Deselect 1 file to start.`,
        ),
      ).toBeInTheDocument();

      await user.click(await findRow("src/file-0001.ts"));
      await waitFor(() => expect(start).toBeEnabled());
    },
  );

  it("holds the side being picked on when the other side gains its first change", async () => {
    const staged = [makeEntry("src/added.ts", "A", " "), makeEntry("src/moved.ts", "R", " ")];
    let current = makeStatus({ files: { staged, unstaged: [], untracked: [] } });
    const { queryClient, onStart } = renderPicker({ status: () => current });
    const user = userEvent.setup();

    // Staged is the only side with changes, so the picker opens on it.
    await user.click(await findRow("src/added.ts"));

    // The user saves a file in their editor and comes back: a refetch under the
    // open picker now finds unstaged changes too.
    current = makeStatus({
      files: { staged, unstaged: [makeEntry("src/b.ts", " ", "M")], untracked: [] },
    });
    await queryClient.refetchQueries();

    expect(screen.getByRole("radio", { name: "Staged" })).toBeChecked();
    expect(await findRow("src/added.ts")).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("button", { name: "Review 1 File" }));
    expect(onStart).toHaveBeenCalledWith({ mode: "staged", files: ["src/moved.ts"] });
  });

  it("keeps the dialog and the selection when the start is refused", async () => {
    // A start that never navigates: home refuses it, and the picker must land
    // back on the list the user built rather than on an empty screen.
    const onStart = vi.fn();
    renderPicker({ onStart });
    const user = userEvent.setup();

    await user.click(await findRow("src/a.ts"));
    await user.click(screen.getByRole("button", { name: "Review 1 File" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeInTheDocument();
    expect(await findRow("src/a.ts")).toHaveAttribute("aria-checked", "false");
    expect(await findRow("src/b.ts")).toHaveAttribute("aria-checked", "true");
  });

  it("lands focus in the file list on open, and arrows walk files without touching the scope", async () => {
    renderPicker();
    const user = userEvent.setup();

    // The tree arrives async; focus must land on the first file once it does,
    // not on the scope chips native dialog focusing would pick.
    await findFocusedRow("src/a.ts");

    await user.keyboard("{ArrowDown}");
    expect(await findRow("src/b.ts")).toHaveFocus();

    // The chips never saw the arrows: the scope stands and so does the selection.
    expect(screen.getByRole("radio", { name: "Unstaged" })).toBeChecked();
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();
  });

  it("walks the zone chain upward: first row to search, search to the chip, chip to [x]", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findFocusedRow("src/a.ts");

    // ↑ on the first row has no row above it — it continues into the search box.
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveFocus();
    // Leaving upward moved focus only: the selection and the scope stand.
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Unstaged" })).toBeChecked();

    // ↑ from the search box lands on the selected scope chip.
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Unstaged" })).toHaveFocus();

    // ↑ from the chips tops the chain out on the [x] close stop.
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  });

  it("returns from [x] to the scope chips on ArrowDown", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    screen.getByRole("radio", { name: "Unstaged" }).focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Unstaged" })).toHaveFocus();
  });

  it("hops from the last scope chip to [Select All] and back", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    screen.getByRole("radio", { name: "Staged" }).focus();

    // → on the last enabled chip is the row's right boundary: it stops on the
    // bulk-select button instead of dying at the group edge.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select All|Clear All/ })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Staged" })).toHaveFocus();
  });

  it("continues vertically from [Select All]: down to search, up to [x]", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    screen.getByRole("radio", { name: "Staged" }).focus();
    await user.keyboard("{ArrowRight}");
    const selectAll = screen.getByRole("button", { name: /Select All|Clear All/ });
    expect(selectAll).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveFocus();

    screen.getByRole("radio", { name: "Staged" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(selectAll).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  });

  it("continues from the last row into the footer actions and back up", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findFocusedRow("src/a.ts");
    await user.keyboard("{ArrowDown}");
    expect(await findRow("src/b.ts")).toHaveFocus();

    // ↓ past the last enabled row enters the footer on the primary action.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Review 2 Files" })).toHaveFocus();

    // ← walks to Cancel; ↑ returns to the last row it left.
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(await findRow("src/b.ts")).toHaveFocus();
  });

  it("falls through to the footer when search's ArrowDown finds no rows", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    await user.keyboard("/");
    await user.keyboard("zzz");
    await within(dialog()).findByText("No unstaged files match the search.");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Review 2 Files" })).toHaveFocus();
  });

  it("hands search's ArrowDown to Retry when the tree cannot be read, ArrowUp returning", async () => {
    renderPicker({
      status: () => {
        throw new Error("Failed to fetch");
      },
    });
    const user = userEvent.setup();

    await screen.findByText("Couldn't read the working tree.");
    const search = screen.getByRole("searchbox", { name: "Search files" });
    await user.click(search);

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(search).toHaveFocus();
  });

  it("hands ArrowDown on a scope chip to the search box without flipping the scope", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    screen.getByRole("radio", { name: "Unstaged" }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveFocus();
    // A radio group's ArrowDown normally moves-and-selects; the interception
    // must run first, so Unstaged is still the scope.
    expect(screen.getByRole("radio", { name: "Unstaged" })).toBeChecked();
  });

  it("starts the review on Enter from the list instead of toggling the row", async () => {
    const { onStart } = renderPicker();
    const user = userEvent.setup();

    const first = await findFocusedRow("src/a.ts");
    await user.keyboard("{Enter}");

    expect(first).toHaveAttribute("aria-checked", "true");
    // The untouched full selection is the menu row's start: no files[] at all.
    expect(onStart).toHaveBeenCalledWith({ mode: "unstaged", files: undefined });
  });

  it("selects all on a and none on n, the TUI's keys", async () => {
    const { onStart } = renderPicker();
    const user = userEvent.setup();

    await findFocusedRow("src/a.ts");

    await user.keyboard("n");
    expect(within(dialog()).getByText("0 of 2 files selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Files" })).toBeDisabled();
    // Enter on an empty selection starts nothing.
    await user.keyboard("{Enter}");
    expect(onStart).not.toHaveBeenCalled();

    await user.keyboard("a");
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();
  });

  it("answers a/n from chip focus too — the dialog-wide shortcut the button advertises", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    expect(screen.getByRole("button", { name: "Clear All" })).toHaveAttribute(
      "aria-keyshortcuts",
      "a n",
    );

    screen.getByRole("radio", { name: "Unstaged" }).focus();
    await user.keyboard("n");
    expect(within(dialog()).getByText("0 of 2 files selected")).toBeInTheDocument();
    await user.keyboard("a");
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();
  });

  it("keeps each side's selection across a scope switch", async () => {
    renderPicker();
    const user = userEvent.setup();

    await user.click(await findRow("src/a.ts"));
    expect(within(dialog()).getByText("1 of 2 files selected")).toBeInTheDocument();

    // The other side opens on its own default: everything checked.
    await user.click(screen.getByRole("radio", { name: "Staged" }));
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();

    // Coming back finds the pick exactly as it was left.
    await user.click(screen.getByRole("radio", { name: "Unstaged" }));
    expect(await findRow("src/a.ts")).toHaveAttribute("aria-checked", "false");
    expect(await findRow("src/b.ts")).toHaveAttribute("aria-checked", "true");
  });

  it("filters the list by path without losing picks the query hides", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    const search = screen.getByRole("searchbox", { name: "Search files" });
    await user.click(search);
    await user.keyboard("b.");

    expect(await findRow("src/b.ts")).toBeInTheDocument();
    expect(queryRow("src/a.ts")).not.toBeInTheDocument();
    // The query narrows what is shown, never what is selected.
    expect(within(dialog()).getByText("2 of 2 files selected")).toBeInTheDocument();

    await user.keyboard("zzz");
    expect(within(dialog()).getByText("No unstaged files match the search.")).toBeInTheDocument();

    await user.clear(search);
    expect(await findRow("src/a.ts")).toHaveAttribute("aria-checked", "true");
  });

  it("scopes a/n to the query's matches, / reaching the box from the list", async () => {
    renderPicker();
    const user = userEvent.setup();

    await findFocusedRow("src/a.ts");
    await user.keyboard("/");
    const search = screen.getByRole("searchbox", { name: "Search files" });
    expect(search).toHaveFocus();

    await user.keyboard("b.");
    await user.keyboard("{ArrowDown}");
    expect(await findRow("src/b.ts")).toHaveFocus();

    // n clears only what is on screen; the hidden pick stands.
    await user.keyboard("n");
    expect(within(dialog()).getByText("1 of 2 files selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await findRow("src/a.ts")).toHaveAttribute("aria-checked", "true");
    expect(await findRow("src/b.ts")).toHaveAttribute("aria-checked", "false");
  });

  it("never starts the review from the search box", async () => {
    const { onStart } = renderPicker();
    const user = userEvent.setup();

    await findRow("src/a.ts");
    await user.keyboard("/");
    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveFocus();

    // Enter in an editable target must not fire the primary action — it hands
    // focus to the list, where Enter does start.
    await user.keyboard("{Enter}");
    expect(onStart).not.toHaveBeenCalled();
    expect(await findRow("src/a.ts")).toHaveFocus();
  });

  it("says how many untracked files the diffs cannot see", async () => {
    renderPicker();

    await findRow("src/a.ts");
    expect(
      within(dialog()).getByText(
        "1 untracked file isn't shown — git diff can't see it until it's added.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps quiet about untracked files when there are none", async () => {
    renderPicker({
      status: makeStatus({
        files: { staged: [], unstaged: [makeEntry("src/a.ts", " ", "M")], untracked: [] },
      }),
    });

    await findRow("src/a.ts");
    expect(screen.queryByText(/untracked file/)).not.toBeInTheDocument();
  });

  it("offers a quiet retry in the list area when the working tree cannot be read", async () => {
    let failing = true;
    renderPicker({
      status: () => {
        if (failing) throw new Error("Failed to fetch");
        return MIXED_STATUS;
      },
    });
    const user = userEvent.setup();

    // A plain line where the list would be, not an error callout — connectivity
    // failures already surface through the shell's offline toast.
    await screen.findByText("Couldn't read the working tree.");
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole("alert")).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await findRow("src/a.ts")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't read the working tree.")).not.toBeInTheDocument();
  });

  it("closes on Esc without starting anything", async () => {
    const onOpenChange = vi.fn();
    const { onStart } = renderPicker({ onOpenChange });

    await findRow("src/b.ts");
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog(), new Event("cancel", { bubbles: false }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("stages Esc from the search box: the first press clears the query, the second closes", async () => {
    const onOpenChange = vi.fn();
    renderPicker({ onOpenChange });
    const user = userEvent.setup();

    await findRow("src/a.ts");
    await user.keyboard("/");
    const search = screen.getByRole("searchbox", { name: "Search files" });
    expect(search).toHaveFocus();
    await user.keyboard("b.");

    // fireEvent retained: the assertion is the keydown's defaultPrevented verdict -- what
    // decides whether the press may reach the dialog -- which userEvent does not expose.
    const clearingPressPropagates = fireEvent.keyDown(search, { key: "Escape" });
    expect(clearingPressPropagates).toBe(false);
    expect(search).toHaveValue("");
    expect(onOpenChange).not.toHaveBeenCalled();

    // fireEvent retained: second press of the same raw keydown sequence -- it must hit the
    // input exactly like the clearing press above so only the empty-query state differs.
    fireEvent.keyDown(search, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog's accessibility contract intact", async () => {
    renderPicker();

    await findRow("src/b.ts");
    expect(dialog()).toHaveAccessibleDescription(
      "Everything checked goes to the model — drop files when the diff does not fit its context window.",
    );
    await expectNoAxeViolations(document.body);
  });
});
