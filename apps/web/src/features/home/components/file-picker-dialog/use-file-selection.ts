import { useGitStatus } from "@diffgazer/core/api/hooks";
import { describeFileStatus, reviewableFilesForMode } from "@diffgazer/core/review";
import { MAX_REVIEW_FILES, type ReviewMode } from "@diffgazer/core/schemas/review";
import { useState } from "react";

/**
 * The two diffs a review can read. `files` is not one of them: the server takes
 * a pathspec filter beside either mode, so a narrowed review keeps the mode the
 * user chose and history keeps reading the way it always has.
 */
export type ReviewFileScope = Exclude<ReviewMode, "files">;

/**
 * What the picker has selected, and what the list it was selected from looks
 * like: the working tree read once, split per scope, filtered by the query, and
 * intersected with what a review could actually read.
 */
export function useFileSelection() {
  const status = useGitStatus();
  // Null means "whichever side has changes", so the tree arriving picks the
  // scope without an effect writing state the render could have derived. An
  // explicit pick wins from the moment it is made.
  const [pickedScope, setPickedScope] = useState<ReviewFileScope | null>(null);
  // Null means "every file listed" — the same review the menu row runs. Storing
  // the default as a value would go stale the moment the list or scope changes.
  // Kept per scope: the sides are different lists (a partially staged file is on
  // both, meaning something different on each), so switching sides must not cost
  // the pick built on the other one.
  const [pickedByScope, setPickedByScope] = useState<Record<ReviewFileScope, string[] | null>>({
    unstaged: null,
    staged: null,
  });
  // One query across both sides: the needle is "find this file", and the file
  // the user is hunting does not change identity when the scope chip does.
  const [query, setQuery] = useState("");

  // Both sides up front: the toggle needs each one's count to know whether it
  // has a list to offer, and core is what decides which files a mode's diff
  // actually carries — untracked files are in neither, so neither is offered.
  const gitStatus = status.data;
  const rowsByScope = {
    unstaged: gitStatus ? reviewableFilesForMode(gitStatus, "unstaged") : [],
    staged: gitStatus ? reviewableFilesForMode(gitStatus, "staged") : [],
  };
  const hasStagedOnly = rowsByScope.unstaged.length === 0 && rowsByScope.staged.length > 0;
  const scope: ReviewFileScope = pickedScope ?? (hasStagedOnly ? "staged" : "unstaged");
  const listed = rowsByScope[scope];
  // The server excludes conflicted files from every review it runs, so they are
  // shown as dead rows rather than offered: picking one would review nothing.
  const selectable = listed.filter((row) => !row.conflicted);
  const untrackedCount = gitStatus?.files.untracked.length ?? 0;

  // The filter narrows what is shown, never what is selected: a file picked
  // before the query hid it stays picked, and the start reads the full pick.
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? listed.filter((row) => row.path.toLowerCase().includes(normalizedQuery))
    : listed;
  const visibleSelectable = visible.filter((row) => !row.conflicted);
  // Sized to the longest status the whole scope carries, so the column cannot
  // shift as the filter changes which rows are on screen.
  const statusWidth = listed.reduce(
    (max, row) => Math.max(max, describeFileStatus(row.status).length),
    0,
  );

  // Intersected with the selectable rows of the scope, so a selection made
  // before a refetch can never start a review for a file the list no longer
  // offers.
  const picked = pickedByScope[scope];
  const selectedPaths = new Set(picked ?? selectable.map((row) => row.path));
  const selected = selectable.map((row) => row.path).filter((path) => selectedPaths.has(path));
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const selectedNow = new Set(selected);
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((row) => selectedNow.has(row.path));
  // The cap the server enforces on `files[]`. A full selection is exempt: it
  // starts with no `files[]` at all, which the server does not cap. Derived
  // rather than raised by a handler so it also bites on an untouched subset
  // left over from a refetch.
  const isOverLimit = !allSelected && selected.length > MAX_REVIEW_FILES;

  const setScope = (value: string | null) => {
    if (value === null) return;
    // Recorded even when it matches the derived scope: that click is what pins
    // the side, so a refetch that changes which side has files cannot move the
    // user off it mid-pick.
    setPickedScope(value as ReviewFileScope);
  };

  // A deliberate pick also pins the side it was made on: a refetch that gives
  // the other side its first file must not move the list out from under it.
  const pickFiles = (next: string[]) => {
    setPickedScope(scope);
    setPickedByScope((cur) => ({ ...cur, [scope]: next }));
  };

  // Bulk selection acts on what is on screen: with no query that is the whole
  // scope (the TUI's a/n), with one it is the matches — "type src/foo, press a".
  const selectVisible = (on: boolean) => {
    const visiblePathSet = new Set(visibleSelectable.map((row) => row.path));
    pickFiles(
      on
        ? [...new Set([...selected, ...visiblePathSet])]
        : selected.filter((path) => !visiblePathSet.has(path)),
    );
  };

  return {
    status,
    scope,
    setScope,
    rowsByScope,
    listed,
    selectable,
    visible,
    visibleSelectable,
    statusWidth,
    untrackedCount,
    query,
    setQuery,
    selected,
    allSelected,
    allVisibleSelected,
    isOverLimit,
    pickFiles,
    selectVisible,
  };
}
