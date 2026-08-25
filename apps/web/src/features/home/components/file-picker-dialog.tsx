import { useGitStatus } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import {
  CONFLICTED_FILE_NOTE,
  describeFileStatus,
  type ReviewableFile,
  reviewableFilesForMode,
} from "@diffgazer/core/review";
import { MAX_REVIEW_FILES, type ReviewMode } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
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
import { Spinner } from "@diffgazer/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { useState } from "react";
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

/** What this scope's diff will say about the file: core's status label, plus where a rename came from. */
function describeRow(row: ReviewableFile): string {
  if (row.conflicted) return CONFLICTED_FILE_NOTE;
  const label = describeFileStatus(row.status);
  return row.previousPath ? `${label} from ${row.previousPath}` : label;
}

const FOOTER_HINTS = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Space", label: "Toggle" },
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
 * The file-scoped review start. The server has always accepted a `files[]`
 * filter beside the mode; this is the screen that offers it, so a diff too big
 * for the model's window — or simply too broad to review well in one pass — can
 * be cut down to the files the user cares about instead of being abandoned.
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
  const [picked, setPicked] = useState<string[] | null>(null);

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

  // Intersected with what is on screen, so a selection made before a refetch
  // can never start a review for a file the list no longer offers.
  const selectedPaths = new Set(picked ?? selectable.map((row) => row.path));
  const selected = selectable.map((row) => row.path).filter((path) => selectedPaths.has(path));
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
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
    // The other side's files are a different list; the default returns with it.
    if (value !== scope) setPicked(null);
  };

  // A deliberate pick also pins the side it was made on: a refetch that gives
  // the other side its first file must not move the list out from under it.
  const pickFiles = (next: string[]) => {
    setPickedScope(scope);
    setPicked(next);
  };

  const handleStart = () => {
    if (selected.length === 0 || isOverLimit) return;
    // An untouched list is the whole scope, and the whole scope needs no
    // pathspecs — that start is the menu row's start, byte for byte.
    onStart({ mode: scope, files: allSelected ? undefined : selected });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden"
        closeOnBackdropClick={!isStarting}
        onEscapeKeyDown={(event) => {
          if (isStarting) event.preventDefault();
        }}
      >
        {/* pr-10 keeps the title clear of the [x] absolutely positioned over it. */}
        <DialogHeader className="pr-10">
          <DialogTitle>Review Specific Files</DialogTitle>
          <DialogDescription>
            Everything left checked goes to the model. Dropping files narrows the diff a review
            reads — the way past a diff that does not fit the model's context window.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-col gap-3 overflow-hidden p-0 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5">
            <ToggleGroup
              value={scope}
              onChange={handleScopeChange}
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
                <Button
                  variant="ghost"
                  size="sm"
                  bracket
                  disabled={isStarting}
                  onClick={() => pickFiles(allSelected ? [] : selectable.map((row) => row.path))}
                >
                  {allSelected ? "Clear All" : "Select All"}
                </Button>
              </div>
            )}
          </div>

          {status.isError && (
            <Callout tone="error" live className="mx-5 py-2 text-2xs">
              <Callout.Content className="flex items-center justify-between gap-3">
                <span>{getErrorMessage(status.error, "The working tree could not be read.")}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => void status.refetch()}
                >
                  Retry
                </Button>
              </Callout.Content>
            </Callout>
          )}

          <ScrollArea className="max-h-[50dvh] flex-1 overscroll-contain px-5 pb-4 scroll-py-1">
            {listed.length > 0 ? (
              <CheckboxGroup
                value={selected}
                onChange={(value) => pickFiles([...value])}
                disabled={isStarting}
                wrap={false}
                aria-label={`${SCOPE_LABELS[scope]} files`}
                className="gap-1"
              >
                {listed.map((row) => (
                  <CheckboxItem
                    key={row.path}
                    value={row.path}
                    disabled={row.conflicted}
                    label={<span className="break-all font-mono text-xs">{row.path}</span>}
                    description={describeRow(row)}
                  />
                ))}
              </CheckboxGroup>
            ) : (
              <EmptyState size="sm" live>
                {status.isPending ? (
                  <>
                    <Spinner variant="braille" size="sm" aria-hidden="true" />
                    <EmptyState.Message>Reading the working tree...</EmptyState.Message>
                  </>
                ) : (
                  <EmptyState.Message>{`No ${scope} changes to review.`}</EmptyState.Message>
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
