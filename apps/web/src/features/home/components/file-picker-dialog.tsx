import { useGitStatus } from "@diffgazer/core/api/hooks";
import {
  CONFLICTED_FILE_NOTE,
  describeFileStatus,
  reviewableFilesForMode,
} from "@diffgazer/core/review";
import { MAX_REVIEW_FILES, type ReviewMode } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { useKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { type KeyboardEvent, useRef, useState } from "react";
import { useDialogScope } from "@/hooks/use-dialog-scope";

/**
 * The two diffs a review can read. `files` is not one of them: the server takes
 * a pathspec filter beside either mode, so a narrowed review keeps the mode the
 * user chose and history keeps reading the way it always has.
 */
export type ReviewFileScope = Exclude<ReviewMode, "files">;

const SCOPE_LABELS: Record<ReviewFileScope, string> = {
  unstaged: "Unstaged",
  staged: "Staged",
};

function untrackedNote(count: number): string {
  return count === 1
    ? "1 untracked file isn't shown — git diff can't see it until it's added."
    : `${count} untracked files aren't shown — git diff can't see them until they're added.`;
}

const FOOTER_HINTS = [
  { key: "/", label: "Search" },
  { key: "↑/↓", label: "Navigate" },
  { key: "Space", label: "Toggle" },
  { key: "a/n", label: "All/None" },
  { key: "Enter", label: "Start" },
  { key: "Esc", label: "Cancel" },
];

export interface FilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Starts the same review a menu row starts, narrowed to `files` when the user dropped any. */
  onStart: (input: { mode: ReviewFileScope; files?: string[] }) => void;
  /** True while a start fired from here is in flight; the dialog holds until the run navigates away. */
  isStarting: boolean;
}

/**
 * The file-scoped review start: the server accepts a `files[]` pathspec filter
 * beside either mode, so a diff too big for the model's window — or too broad
 * to review well in one pass — can be narrowed to the files the user cares
 * about instead of abandoned.
 */
export function FilePickerDialog({
  open,
  onOpenChange,
  onStart,
  isStarting,
}: FilePickerDialogProps) {
  useDialogScope("review-file-picker", { enabled: open });
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
  // One-shot guard for the list's autoFocus: once the list has claimed focus —
  // or the user has put it in the search box first — a group (re)mount must not
  // pull focus away from wherever the user has it.
  const [listAutoFocusSpent, setListAutoFocusSpent] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);

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

  const handleScopeChange = (value: string | null) => {
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

  const focusList = () => {
    listRef.current
      ?.querySelector<HTMLElement>('[role="checkbox"]:not([aria-disabled="true"])')
      ?.focus();
  };

  // Roving tabindex marks the selected chip as the group's tab target.
  const focusScopeChips = () => {
    scopeRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
  };

  // Vertical keys walk the dialog's zones (chips ↕ search ↕ list) instead of
  // switching chips — Left/Right stay the switching keys. Runs before the
  // group's own radio navigation and preventDefault suppresses it, so an
  // intercepted key can never move-and-select a chip. j/k mirror the list.
  const handleScopeKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
    }
  };

  // The house search key. useKey ignores editable targets by default, so "/"
  // typed inside the search box stays a character.
  useKey("/", () => searchRef.current?.focus(), {
    enabled: open && !isStarting,
    preventDefault: true,
  });

  const handleStart = () => {
    if (isStarting || selected.length === 0 || isOverLimit) return;
    // An untouched list is the whole scope, and the whole scope needs no
    // pathspecs — that start is the menu row's start, byte for byte.
    onStart({ mode: scope, files: allSelected ? undefined : selected });
  };

  // Runs before the group's built-in handling; preventDefault suppresses it.
  // Enter is the dialog's primary action here — every other dialog's Enter
  // confirms, so a second Space it is not. a/n mirror the TUI's select-all/none.
  const handleListKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      handleStart();
      return;
    }
    if (event.key === "a" || event.key === "n") {
      event.preventDefault();
      selectVisible(event.key === "a");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        height="stable"
        className="overflow-hidden"
        closeOnBackdropClick={!isStarting}
        onEscapeKeyDown={(event) => {
          if (isStarting) event.preventDefault();
        }}
      >
        {/* pr-10 keeps the title clear of the [x] absolutely positioned over it. */}
        <DialogHeader className="pr-10">
          <DialogTitle className="shrink-0">Review Specific Files</DialogTitle>
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            Narrow the diff a review reads
          </p>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-col gap-3 overflow-hidden p-0 pt-4">
          <DialogDescription className="px-5">
            Everything checked goes to the model — drop files when the diff does not fit its context
            window.
          </DialogDescription>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5">
            <ToggleGroup
              ref={scopeRef}
              value={scope}
              onChange={handleScopeChange}
              onKeyDown={handleScopeKeyDown}
              label="Changes"
              disabled={isStarting}
            >
              {(["unstaged", "staged"] as const).map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  // A side with nothing in it has no list to show, so it is
                  // offered as unavailable rather than as an empty screen.
                  disabled={status.isSuccess && rowsByScope[value].length === 0}
                >
                  {SCOPE_LABELS[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {selectable.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-2xs text-muted-foreground">
                  {`${selected.length} of ${pluralize(selectable.length, "file")} selected`}
                </span>
                {visibleSelectable.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    bracket
                    disabled={isStarting}
                    onClick={() => selectVisible(!allVisibleSelected)}
                  >
                    {allVisibleSelected ? "Clear All" : "Select All"}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="px-5">
            <SearchInput
              ref={searchRef}
              value={query}
              onChange={setQuery}
              disabled={isStarting}
              // Typing here before the tree arrives must not end with the list
              // yanking focus out of the box the moment it mounts.
              onFocus={() => setListAutoFocusSpent(true)}
              aria-label="Search files"
              placeholder="Search files..."
              size="md"
              className="w-full bg-input-well"
              onKeyDown={(event) => {
                // ArrowDown leaves the box for the list, the model-select move.
                // Enter must not start a review from an editable target — with
                // no form in the dialog it submits nothing, so it goes to the
                // list too instead of dying silently.
                if (event.key === "ArrowDown" || event.key === "Enter") {
                  event.preventDefault();
                  focusList();
                  return;
                }
                // ArrowUp leaves upward for the scope chips.
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusScopeChips();
                }
              }}
            />
          </div>

          {untrackedCount > 0 && (
            <p className="px-5 text-2xs text-muted-foreground">{untrackedNote(untrackedCount)}</p>
          )}

          {/* scroll-p mirrors p: without scroll-padding, navigation parks rows
              flush with the clipped padding-box edge, which cuts the 1px focus
              ring painted outside the row. */}
          <ScrollArea className="min-h-0 flex-1 overscroll-contain px-5 pt-1 pb-4 scroll-pt-1 scroll-pb-4">
            {visible.length > 0 ? (
              <div ref={listRef} onFocusCapture={() => setListAutoFocusSpent(true)}>
                <CheckboxGroup
                  value={selected}
                  onChange={(value) => pickFiles([...value])}
                  onKeyDown={handleListKeyDown}
                  disabled={isStarting}
                  wrap={false}
                  // ↑ on the first row continues into the search box; the
                  // bottom boundary stays a no-op.
                  onNavigationBoundaryReached={(direction) => {
                    if (direction === "previous") searchRef.current?.focus();
                  }}
                  // Focus lands in the list, however late the tree arrives — the
                  // footer's "↑/↓ Navigate" must be true from the first keypress,
                  // not after a Tab past the scope chips. One-shot: after that,
                  // filter-driven remounts leave focus where the user put it.
                  autoFocus={!listAutoFocusSpent}
                  aria-label={`${SCOPE_LABELS[scope]} files`}
                  className="gap-1"
                >
                  {visible.map((row) => (
                    <CheckboxItem
                      key={row.path}
                      value={row.path}
                      disabled={row.conflicted}
                      // First-line baseline alignment: a break-all path wrapped
                      // to two lines keeps the [x] and status column on the
                      // path's first line instead of mid-block.
                      className="items-baseline"
                      // The TUI's single-row layout: a fixed muted status column,
                      // then the path — no second line, so the list stays scannable
                      // at hundreds of files. Conflicts keep their explanatory line.
                      label={
                        <span className="flex min-w-0 gap-2 font-mono text-xs">
                          <span
                            className="shrink-0 text-muted-foreground"
                            style={{ minWidth: `${statusWidth}ch` }}
                          >
                            {describeFileStatus(row.status)}
                          </span>
                          <span className="break-all">{row.path}</span>
                          {row.previousPath && (
                            <span className="break-all text-muted-foreground">
                              {`← ${row.previousPath}`}
                            </span>
                          )}
                        </span>
                      }
                      description={row.conflicted ? CONFLICTED_FILE_NOTE : undefined}
                    />
                  ))}
                </CheckboxGroup>
              </div>
            ) : (
              <EmptyState size="sm" live>
                {status.isPending && (
                  <>
                    <Spinner variant="braille" size="sm" aria-hidden="true" />
                    <EmptyState.Message>Reading the working tree...</EmptyState.Message>
                  </>
                )}
                {/* Connectivity already owns a toast; the list only says it has
                    nothing to show and offers the way back in. */}
                {status.isError && (
                  <>
                    <EmptyState.Message>Couldn't read the working tree.</EmptyState.Message>
                    <EmptyState.Actions>
                      <Button
                        variant="ghost"
                        size="sm"
                        bracket
                        onClick={() => void status.refetch()}
                      >
                        Retry
                      </Button>
                    </EmptyState.Actions>
                  </>
                )}
                {status.isSuccess && (
                  <EmptyState.Message>
                    {listed.length > 0
                      ? `No ${scope} files match the search.`
                      : `No ${scope} changes to review.`}
                  </EmptyState.Message>
                )}
              </EmptyState>
            )}
          </ScrollArea>

          {isOverLimit && (
            <Callout tone="warning" live className="mx-5 mb-4 py-2 text-2xs">
              <Callout.Content>
                {`A review reads at most ${MAX_REVIEW_FILES} files. Deselect ${pluralize(selected.length - MAX_REVIEW_FILES, "file")} to start.`}
              </Callout.Content>
            </Callout>
          )}
        </DialogBody>

        <DialogFooter hints={FOOTER_HINTS}>
          <DialogClose variant="ghost" size="sm" bracket disabled={isStarting}>
            Cancel
          </DialogClose>
          <DialogAction
            size="sm"
            disabled={selected.length === 0 || isOverLimit}
            loading={isStarting}
            // The start is not a dismissal: the dialog holds its selection until
            // the run navigates away, so a refused start lands back on the list
            // the user built instead of on an empty screen.
            onClick={(event) => {
              event.preventDefault();
              handleStart();
            }}
          >
            {selected.length > 0 ? `Review ${pluralize(selected.length, "File")}` : "Review Files"}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
