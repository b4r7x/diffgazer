import { createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { GitFileEntry, GitFileStatusCode, GitStatus } from "@diffgazer/core/schemas/git";
import { MAX_REVIEW_FILES } from "@diffgazer/core/schemas/review";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FilePickerDialog, type FilePickerDialogProps } from "./file-picker-dialog";

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
function PickerHarness(props: Omit<FilePickerDialogProps, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true);
  return <FilePickerDialog {...props} open={open} onOpenChange={setOpen} />;
}

function renderPicker({
  status = MIXED_STATUS,
  onStart = vi.fn(),
  isStarting = false,
}: {
  /** A function is read per request, so a test can change the tree under an open picker. */
  status?: GitStatus | (() => GitStatus);
  onStart?: FilePickerDialogProps["onStart"];
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
            <PickerHarness onStart={onStart} isStarting={isStarting} />
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

async function findRow(name: string): Promise<HTMLElement> {
  return await screen.findByRole("checkbox", { name });
}

describe("FilePickerDialog", () => {
  it("lists the files the chosen scope's diff carries, labelled the way core labels them", async () => {
    renderPicker();

    expect(await findRow("src/a.ts")).toHaveAccessibleDescription("modified");
    expect(await findRow("src/b.ts")).toBeInTheDocument();
    // Untracked files are in neither diff, so offering one would review nothing.
    expect(screen.queryByRole("checkbox", { name: "src/new.ts" })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("radio", { name: "Staged" }));

    expect(await findRow("src/added.ts")).toHaveAccessibleDescription("added");
    expect(await findRow("src/moved.ts")).toHaveAccessibleDescription("renamed from src/old.ts");
    expect(screen.queryByRole("checkbox", { name: "src/a.ts" })).not.toBeInTheDocument();
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
  it("refuses a subset past the server's file cap but exempts the full selection", { timeout: 90_000 }, async () => {
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
  });

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
});
