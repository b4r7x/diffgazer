import { MAX_REVIEW_FILES } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogCloseIcon,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { useDialogScope } from "@/hooks/use-dialog-scope";
import { FilePickerList } from "./file-list";
import { useFilePickerKeyboard } from "./use-dialog-keyboard";
import { type ReviewFileScope, useFileSelection } from "./use-file-selection";

export type { ReviewFileScope };

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
  const selection = useFileSelection();
  const canStart = !isStarting && selection.selected.length > 0 && !selection.isOverLimit;

  const handleStart = () => {
    if (!canStart) return;
    // An untouched list is the whole scope, and the whole scope needs no
    // pathspecs — that start is the menu row's start, byte for byte.
    onStart({
      mode: selection.scope,
      files: selection.allSelected ? undefined : selection.selected,
    });
  };

  const keyboard = useFilePickerKeyboard({
    open,
    isStarting,
    canStart,
    selectVisible: selection.selectVisible,
    onStart: handleStart,
    onCancel: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        height="stable"
        className="overflow-hidden"
        closeIcon={false}
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
              ref={keyboard.scopeRef}
              value={selection.scope}
              onChange={selection.setScope}
              onKeyDown={keyboard.handleScopeKeyDown}
              label="Changes"
              disabled={isStarting}
            >
              {(["unstaged", "staged"] as const).map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  // A side with nothing in it has no list to show, so it is
                  // offered as unavailable rather than as an empty screen.
                  disabled={selection.status.isSuccess && selection.rowsByScope[value].length === 0}
                >
                  {SCOPE_LABELS[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {selection.selectable.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-2xs text-muted-foreground">
                  {`${selection.selected.length} of ${pluralize(selection.selectable.length, "file")} selected`}
                </span>
                {selection.visibleSelectable.length > 0 && (
                  <Button
                    ref={keyboard.selectAllRef}
                    variant="ghost"
                    size="sm"
                    bracket
                    disabled={isStarting}
                    aria-keyshortcuts="a n"
                    onClick={() => selection.selectVisible(!selection.allVisibleSelected)}
                    onKeyDown={keyboard.handleSelectAllKeyDown}
                  >
                    {selection.allVisibleSelected ? "Clear All" : "Select All"}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="px-5">
            <SearchInput
              ref={keyboard.searchRef}
              value={selection.query}
              onChange={selection.setQuery}
              disabled={isStarting}
              // Typing here before the tree arrives must not end with the list
              // yanking focus out of the box the moment it mounts.
              onFocus={keyboard.spendListAutoFocus}
              onEscape={() => {
                if (!isStarting) onOpenChange(false);
              }}
              aria-label="Search files"
              placeholder="Search files..."
              size="md"
              className="w-full bg-input-well"
              onKeyDown={keyboard.handleSearchKeyDown}
            />
          </div>

          {selection.untrackedCount > 0 && (
            <p className="px-5 text-2xs text-muted-foreground">
              {untrackedNote(selection.untrackedCount)}
            </p>
          )}

          {/* scroll-p mirrors p: without scroll-padding, navigation parks rows
              flush with the clipped padding-box edge, which cuts the 1px focus
              ring painted outside the row. */}
          <ScrollArea className="min-h-0 flex-1 overscroll-contain px-5 pt-1 pb-4 scroll-pt-1 scroll-pb-4">
            <FilePickerList
              rows={selection.visible}
              selected={selection.selected}
              statusWidth={selection.statusWidth}
              scope={selection.scope}
              scopeLabel={SCOPE_LABELS[selection.scope]}
              hasListedRows={selection.listed.length > 0}
              disabled={isStarting}
              listRef={keyboard.listRef}
              retryRef={keyboard.retryRef}
              autoFocus={!keyboard.listAutoFocusSpent}
              isPending={selection.status.isPending}
              isError={selection.status.isError}
              isSuccess={selection.status.isSuccess}
              onFocusCapture={keyboard.spendListAutoFocus}
              onChange={selection.pickFiles}
              onKeyDown={keyboard.handleListKeyDown}
              onNavigationBoundaryReached={keyboard.handleListBoundary}
              onRetry={() => void selection.status.refetch()}
              onRetryKeyDown={keyboard.handleRetryKeyDown}
            />
          </ScrollArea>

          {selection.isOverLimit && (
            <Callout tone="warning" live className="mx-5 mb-4 py-2 text-2xs">
              <Callout.Content>
                {`A review reads at most ${MAX_REVIEW_FILES} files. Deselect ${pluralize(selection.selected.length - MAX_REVIEW_FILES, "file")} to start.`}
              </Callout.Content>
            </Callout>
          )}
        </DialogBody>

        <DialogFooter ref={keyboard.footerRef} hints={FOOTER_HINTS}>
          <DialogClose
            {...keyboard.footerActions.getActionProps(0)}
            variant="ghost"
            size="sm"
            bracket
            disabled={isStarting}
          >
            Cancel
          </DialogClose>
          <DialogAction
            {...keyboard.footerActions.getActionProps(1)}
            size="sm"
            disabled={selection.selected.length === 0 || selection.isOverLimit}
            loading={isStarting}
            // The start is not a dismissal: the dialog holds its selection until
            // the run navigates away, so a refused start lands back on the list
            // the user built instead of on an empty screen.
            onClick={(event) => {
              event.preventDefault();
              handleStart();
            }}
          >
            {selection.selected.length > 0
              ? `Review ${pluralize(selection.selected.length, "File")}`
              : "Review Files"}
          </DialogAction>
        </DialogFooter>

        <DialogCloseIcon
          ref={keyboard.closeRef}
          disabled={isStarting}
          onKeyDown={keyboard.handleCloseIconKeyDown}
        />
      </DialogContent>
    </Dialog>
  );
}
