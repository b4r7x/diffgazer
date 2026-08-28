import {
  CONFLICTED_FILE_NOTE,
  describeFileStatus,
  type ReviewableFile,
} from "@diffgazer/core/review";
import { Button } from "@diffgazer/ui/components/button";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Spinner } from "@diffgazer/ui/components/spinner";
import type { KeyboardEvent, Ref } from "react";
import type { ReviewFileScope } from "./use-file-selection";

export interface FilePickerListProps {
  /** The rows the query left on screen; empty swaps the list for the state below it. */
  rows: ReviewableFile[];
  selected: string[];
  statusWidth: number;
  scope: ReviewFileScope;
  scopeLabel: string;
  /** True once the scope has files at all, so an empty screen can say which emptiness it is. */
  hasListedRows: boolean;
  disabled: boolean;
  listRef: Ref<HTMLDivElement>;
  retryRef: Ref<HTMLButtonElement>;
  autoFocus: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  onFocusCapture: () => void;
  onChange: (paths: string[]) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onNavigationBoundaryReached: (direction: "previous" | "next") => void;
  onRetry: () => void;
  onRetryKeyDown: (event: KeyboardEvent) => void;
}

/** The rows a narrowed review would read, or the reason there are none. */
export function FilePickerList({
  rows,
  selected,
  statusWidth,
  scope,
  scopeLabel,
  hasListedRows,
  disabled,
  listRef,
  retryRef,
  autoFocus,
  isPending,
  isError,
  isSuccess,
  onFocusCapture,
  onChange,
  onKeyDown,
  onNavigationBoundaryReached,
  onRetry,
  onRetryKeyDown,
}: FilePickerListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState size="sm" live>
        {isPending && (
          <>
            <Spinner variant="braille" size="sm" aria-hidden="true" />
            <EmptyState.Message>Reading the working tree...</EmptyState.Message>
          </>
        )}
        {/* Connectivity already owns a toast; the list only says it has
            nothing to show and offers the way back in. */}
        {isError && (
          <>
            <EmptyState.Message>Couldn't read the working tree.</EmptyState.Message>
            <EmptyState.Actions>
              <Button
                ref={retryRef}
                variant="ghost"
                size="sm"
                bracket
                onClick={onRetry}
                onKeyDown={onRetryKeyDown}
              >
                Retry
              </Button>
            </EmptyState.Actions>
          </>
        )}
        {isSuccess && (
          <EmptyState.Message>
            {hasListedRows
              ? `No ${scope} files match the search.`
              : `No ${scope} changes to review.`}
          </EmptyState.Message>
        )}
      </EmptyState>
    );
  }

  return (
    <div ref={listRef} onFocusCapture={onFocusCapture}>
      <CheckboxGroup
        value={selected}
        onChange={(value) => onChange([...value])}
        onKeyDown={onKeyDown}
        disabled={disabled}
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
        // Focus lands in the list, however late the tree arrives — the
        // footer's "↑/↓ Navigate" must be true from the first keypress,
        // not after a Tab past the scope chips. One-shot: after that,
        // filter-driven remounts leave focus where the user put it.
        autoFocus={autoFocus}
        aria-label={`${scopeLabel} files`}
        className="gap-1"
      >
        {rows.map((row) => (
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
                  <span className="break-all text-muted-foreground">{`← ${row.previousPath}`}</span>
                )}
              </span>
            }
            description={row.conflicted ? CONFLICTED_FILE_NOTE : undefined}
          />
        ))}
      </CheckboxGroup>
    </div>
  );
}
