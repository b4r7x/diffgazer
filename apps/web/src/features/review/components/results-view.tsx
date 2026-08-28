import { formatRunId } from "@diffgazer/core/format";
import {
  buildDuplicateCollapseNotice,
  buildLensFailureNotice,
  describeTerminalOutcome,
  type FailedTerminalOutcome,
  selectDetailsEmptyKind,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { IssueDetailsPane } from "@/features/review/components/issue-details-pane/pane";
import { IssueListPane } from "@/features/review/components/issue-list-pane";
import { useReviewResultsKeyboard } from "../hooks/use-results-keyboard";

interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId: string | null;
  initialIssueId?: string | null;
  droppedDuplicates?: number;
  lensStats?: LensStat[];
  /** Set when the run ended on a failed outcome; a deep link opens here without passing the summary. */
  outcome?: FailedTerminalOutcome;
  onBackToSummary?: () => void;
}

export function ReviewResultsView({
  issues,
  reviewId,
  initialIssueId,
  droppedDuplicates,
  lensStats,
  outcome,
  onBackToSummary,
}: ReviewResultsViewProps) {
  const {
    filteredIssues,
    selectedIssue,
    selectedIssueId,
    selectIssueAndFocusList,
    selectIssue,
    handleListBoundary,
    activeTab,
    setActiveTab,
    filter,
    focusZone,
    handleDetailsTabsBoundary,
    handleListFocus,
    listRef,
    listBodyRef,
    detailsPaneRef,
    detailsScrollRef,
    completedSteps,
    handleToggleStep,
    focusedStepIndex,
    setFocusedStepIndex,
    mobilePane,
    backToList,
  } = useReviewResultsKeyboard({ issues, initialIssueId, onBackToSummary });
  const detailsEmptyKind = selectDetailsEmptyKind(filteredIssues.length);
  const duplicateNotice = buildDuplicateCollapseNotice(droppedDuplicates, issues.length);
  // A run that lost lenses must say so wherever it is opened, not only in the
  // live progress view - otherwise a partial result reads as a complete one.
  const completenessNotice = buildLensFailureNotice(lensStats);
  // A findings deep link reaches this screen without passing the summary, so the
  // outcome that stopped the run - and its remedy - are told here too. Without
  // it the completeness notice reads as "a lens errored", never "the run ended".
  const failure = outcome ? describeTerminalOutcome(outcome) : null;
  const runDisplayId = reviewId ? formatRunId(reviewId) : "#unknown";
  // Below md only the active pane is shown; both stay side-by-side from md up.
  const listPaneClassName = mobilePane === "details" ? "hidden md:flex" : undefined;
  const detailsPaneClassName = mobilePane === "list" ? "hidden md:flex" : undefined;

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2 font-mono">
      {/* The list pane's corner chip shows the run id as aria-hidden decoration,
          so the screen's identity heading lives here for assistive tech. */}
      <h2 className="sr-only">Review {runDisplayId}</h2>
      {failure || completenessNotice || duplicateNotice ? (
        <div className="shrink-0 space-y-1 pt-2">
          {failure ? (
            <p className="border-l-2 border-error-border pl-2 text-xs text-error-text" role="alert">
              {`${failure.title} — ${failure.message}`}
            </p>
          ) : null}
          {completenessNotice ? (
            // Rail kept hand-rolled: this one-line note already paints what
            // frame="rail" tone="warning" would paint, so converging buys only
            // a Panel wrapper and its padding.
            <p
              className="border-l-2 border-warning-border pl-2 text-xs text-warning-text"
              role="note"
            >
              {completenessNotice}
            </p>
          ) : null}
          {duplicateNotice ? (
            <p className="text-xs text-muted-foreground" role="note">
              {duplicateNotice}
            </p>
          ) : null}
        </div>
      ) : null}
      <section
        aria-label="Review result panes"
        data-viewport="review-results"
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        {/* Same pane rhythm as history/providers: chip-labelled hairline Panels
            on a grid, 1px column gap so the frames read as one shared rule, pt-4
            clearing the notched Panel.Label overhang, --panel-hairline lifted to
            the full border token (this deliberately firms inner rules too). The
            single fractional row keeps the one visible pane full-height below md
            (mobile pane-swap). */}
        <div
          data-row="review"
          data-mobile-pane={mobilePane}
          className="grid flex-1 min-h-0 grid-rows-[minmax(0,1fr)] gap-x-px overflow-hidden pt-4 [--panel-hairline:var(--border)] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <IssueListPane
            issues={filteredIssues}
            allIssues={issues}
            runDisplayId={runDisplayId}
            selectedIssueId={selectedIssueId}
            highlightedIssueId={selectedIssueId}
            onSelectIssue={selectIssueAndFocusList}
            onHighlightIssue={selectIssue}
            onListBoundaryReached={handleListBoundary}
            onListFocus={handleListFocus}
            filter={filter}
            listRef={listRef}
            listBodyRef={listBodyRef}
            isFocused={focusZone === "list"}
            className={listPaneClassName}
          />
          <IssueDetailsPane
            issue={selectedIssue}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onTabsBoundaryReached={handleDetailsTabsBoundary}
            completedSteps={completedSteps}
            onToggleStep={handleToggleStep}
            focusedStepIndex={focusedStepIndex}
            onFocusedStepIndexChange={setFocusedStepIndex}
            paneRef={detailsPaneRef}
            scrollAreaRef={detailsScrollRef}
            emptyKind={detailsEmptyKind}
            onBackToList={backToList}
            className={detailsPaneClassName}
          />
        </div>
      </section>
    </div>
  );
}
