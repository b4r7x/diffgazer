import { useProviderConsentGate } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  classifyReviewStreamError,
  type FailedTerminalOutcome,
  getAlternateReviewMode,
  isProviderRecoveryError,
  mapStepsToProgressDataWithAgents,
  savedRunExists,
} from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { BACK_SHORTCUTS, type Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  ReviewErrorCode,
  type ReviewMode,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import { Box, useInput } from "ink";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { ProviderConsentOverlay } from "../../../components/shared/provider-consent-overlay";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Spinner } from "../../../components/ui/spinner";
import { useActionRow } from "../../../hooks/use-action-row";
import { useNavigation } from "../../../hooks/use-navigation";
import { useReviewLifecycle } from "../hooks/use-lifecycle";
import {
  getProviderRecoveryLine,
  getProviderRecoveryShortcut,
  PROVIDER_RECOVERY_KEY,
} from "../lib/provider-recovery";
import {
  ApiKeyMissingView,
  ConfigurationErrorView,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";
import { type ReviewFileFilterStart, ReviewFileFilterView } from "./file-filter-view";
import { ACTION_SHORTCUTS } from "./gate-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view/view";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

interface ReviewStreamContainerProps {
  // Matches the review route, which carries no file-selection mode.
  mode?: Exclude<ReviewMode, "files">;
  /** Opens the file picker instead of starting the run, for a scope chosen before any run exists. */
  pickFiles?: boolean;
  reviewId?: string;
  allowResumeWithoutSetup?: boolean;
  onStreamNotFound?: (reviewId: string) => void;
  /** Opens the saved record of a run that failed after some lenses had reported. */
  onViewRunDetails?: (reviewId: string) => void;
}

/** The one key both the running advisory and the dead run publish for the picker. */
const FILTER_FILES_KEY = "f";
const FILTER_FILES_LABEL = "Review Specific Files";

/**
 * The failures a narrower file set is a real second move for: the run reached
 * its diff and could not get through it in one pass — past the model's context
 * window, past the hard size ceiling, or out of budget before every lens ran.
 * Every other failure has its own remedy, and offering the picker there would
 * dress a provider or trust fault up as a size problem.
 */
const NARROWABLE_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  ReviewErrorCode.DIFF_TOO_LARGE,
  ReviewErrorCode.BUDGET_EXHAUSTED,
]);

/**
 * Where the picker was opened from: a run that was warned or refused carries
 * the reason it sends the user here, a scope picked before any run has none.
 */
type FileFilterState = { origin: "pre-run" } | { origin: "narrow"; reason: string };

interface ReviewTerminalReceiptContainerProps {
  terminalOutcome: FailedTerminalOutcome;
  usageAvailability?: UsageAvailability;
  onBack: () => void;
}

type ReviewContainerProps = ReviewStreamContainerProps | ReviewTerminalReceiptContainerProps;

function ReviewLoadingView({ message }: { message: string }): ReactElement {
  usePageFooter({ shortcuts: [] });

  // Same placement every other loading state in the TUI uses: the run takes the
  // frame it is about to fill instead of hanging off the top-left corner.
  return (
    <Box flexGrow={1} alignItems="center" justifyContent="center">
      <Spinner label={message} />
    </Box>
  );
}

function ReviewTerminalErrorView({
  title,
  error,
  guidance,
  onBack,
  recovery,
  onFilterFiles,
}: {
  title: string;
  error: string;
  guidance?: string;
  onBack: () => void;
  /** Set when the failure is fixed on the providers screen; adds the `p` recovery shortcut, named by the CTA. */
  recovery?: { label: string; open: () => void };
  /**
   * Set for a run that actually reached the diff. A dead review offers Back and
   * nothing else; this is the second move — start again over fewer files —
   * which is the stated remedy when the diff did not fit the model's window,
   * and never claims to repair the failure it sits under.
   */
  onFilterFiles?: () => void;
}): ReactElement {
  const filterShortcut: Shortcut = { key: FILTER_FILES_KEY, label: FILTER_FILES_LABEL };
  usePageFooter({
    shortcuts:
      recovery || onFilterFiles
        ? [
            ...ACTION_SHORTCUTS,
            ...(recovery ? [getProviderRecoveryShortcut(recovery.label)] : []),
            ...(onFilterFiles ? [filterShortcut] : []),
          ]
        : [],
    rightShortcuts: BACK_SHORTCUTS,
  });
  // The row is built left to right — recovery, then the picker, then Back.
  const recoveryCount = recovery ? 1 : 0;
  const filterCount = onFilterFiles ? 1 : 0;
  const actionCount = recoveryCount + filterCount + 1;
  // Each button owns its own Enter; the row owns Left/Right and the single mark.
  const actions = useActionRow({ actionCount });
  useInput(
    (input, key) => {
      if (key.escape) {
        onBack();
      } else if (input === PROVIDER_RECOVERY_KEY && recovery) {
        recovery.open();
      } else if (input === FILTER_FILES_KEY && onFilterFiles) {
        onFilterFiles();
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Callout variant="error">
        <Callout.Title>{title}</Callout.Title>
        <Callout.Content>{sanitizeTerminalText(error)}</Callout.Content>
        {guidance ? <Callout.Content>{guidance}</Callout.Content> : null}
        {recovery ? (
          <Callout.Content>{getProviderRecoveryLine(recovery.label)}</Callout.Content>
        ) : null}
        {onFilterFiles ? (
          <Callout.Content>{`Press ${FILTER_FILES_KEY} — ${FILTER_FILES_LABEL}.`}</Callout.Content>
        ) : null}
      </Callout>
      <Box gap={2}>
        {recovery ? (
          <Button variant="secondary" isActive={actions.isActionActive(0)} onPress={recovery.open}>
            {recovery.label}
          </Button>
        ) : null}
        {onFilterFiles ? (
          <Button
            variant="secondary"
            isActive={actions.isActionActive(recoveryCount)}
            onPress={onFilterFiles}
          >
            {FILTER_FILES_LABEL}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          isActive={actions.isActionActive(actionCount - 1)}
          onPress={onBack}
        >
          Back
        </Button>
      </Box>
    </Box>
  );
}

export function ReviewContainer(props: ReviewContainerProps): ReactElement {
  if ("terminalOutcome" in props) {
    return (
      <ReviewTerminalReceiptView
        outcome={props.terminalOutcome}
        usageAvailability={props.usageAvailability}
        onBack={props.onBack}
      />
    );
  }

  return <ReviewStreamContainer {...props} />;
}

function ReviewStreamContainer({
  mode,
  pickFiles = false,
  reviewId,
  allowResumeWithoutSetup = false,
  onStreamNotFound,
  onViewRunDetails,
}: ReviewStreamContainerProps): ReactElement {
  const { navigate, goBack } = useNavigation();
  const { state, start, cancel, goToSummary, goToResults, retryConfig, reset } = useReviewLifecycle(
    {
      mode,
      reviewId,
      allowResumeWithoutSetup,
      onStreamNotFound,
    },
  );
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const switchingModeRef = useRef(false);
  // The picker is a step of this flow, not a route: reached from a run that was
  // warned or refused, leaving it returns to that run's screen rather than to
  // whatever pushed the review route; reached before any run, it is the first
  // thing the screen shows.
  const [fileFilter, setFileFilter] = useState<FileFilterState | null>(
    pickFiles ? { origin: "pre-run" } : null,
  );
  // Switching starts a new review, so it waits for the provider consent like
  // the start on home does; declining leaves the no-diff screen as it was.
  const consent = useProviderConsentGate(state.providerConsent);

  function handleGateBack() {
    reset({ clearActiveSession: true });
    goBack();
  }

  function goToProviderSettings() {
    reset();
    navigate({ screen: "settings/providers" });
  }

  function handleRunningBack() {
    reset();
    navigate({ screen: "home" });
  }

  // The advisory arrives while the run is still reading, so narrowing it means
  // stopping it first. A cancel that reports back is a run still going: the
  // screen stays as it was rather than opening a picker whose start would be
  // refused, mirroring what the cancel shortcut itself does.
  function cancelAndFilterFiles(reason: string) {
    void cancel().then((cancelError) => {
      if (cancelError) return;
      setFileFilter({ origin: "narrow", reason });
    });
  }

  async function startFilteredReview({ mode: scope, files }: ReviewFileFilterStart) {
    setFileFilter(null);
    const result = await start(scope, { fresh: true, ...(files ? { files } : {}) });
    if (result === "setup-required") navigate({ screen: "settings/providers" });
  }

  // A picked scope is the start this screen was opened for, so the automatic
  // one stands down rather than racing it with the whole diff.
  const hasStarted = useRef(pickFiles);

  useEffect(() => {
    if (mode && !reviewId && state.initState.status === "ready" && !hasStarted.current) {
      hasStarted.current = true;
      void start(mode);
    }
  }, [mode, reviewId, start, state.initState.status]);

  const isSettledError =
    state.gate === "terminal-error" ||
    (Boolean(state.error) && state.phase !== "streaming" && state.phase !== "completing");
  // A saved run whose lenses got somewhere is worth opening instead of ending on
  // a dead end. Same gate as the web container.
  const failedRunId = state.reviewId;
  const canViewRun =
    isSettledError &&
    failedRunId !== null &&
    onViewRunDetails !== undefined &&
    savedRunExists(state.completion.lensStats, state.errorCode);
  const hasOpenedFailedRun = useRef(false);

  // Navigation, not derived state: the settled run hands the screen off to its
  // saved record once, without waiting for a keypress. The failure screen stays
  // for everything with nothing on disk to open.
  useEffect(() => {
    if (!canViewRun || hasOpenedFailedRun.current) return;
    hasOpenedFailedRun.current = true;
    reset({ clearActiveSession: true });
    onViewRunDetails(failedRunId);
  }, [canViewRun, failedRunId, onViewRunDetails, reset]);

  if (state.initState.status === "loading") {
    return <ReviewLoadingView message="Loading configuration..." />;
  }

  if (consent.isOpen) return <ProviderConsentOverlay gate={consent} />;

  if (fileFilter) {
    // Before any run there is no mode to inherit and nothing to go back to on
    // this screen, so the picker owns the scope and Escape returns to whatever
    // opened the route. Either way the start asks for the consent the menu
    // rows on home ask for.
    const onStart = (input: ReviewFileFilterStart) =>
      consent.require(() => void startFilteredReview(input));
    return fileFilter.origin === "pre-run" ? (
      <ReviewFileFilterView onStart={onStart} onBack={goBack} />
    ) : (
      <ReviewFileFilterView
        mode={state.mode}
        reason={fileFilter.reason}
        onStart={onStart}
        onBack={() => setFileFilter(null)}
      />
    );
  }

  if (state.initState.status === "error") {
    return (
      <ConfigurationErrorView
        error={state.initState.error}
        onRetry={() => {
          void retryConfig();
        }}
        onGoToSettings={goToProviderSettings}
        onBack={handleGateBack}
      />
    );
  }

  // Configuration we cannot resolve yet is the only wait with nothing behind
  // it. Once the run is admitted the progress screen carries its own start (see
  // the phase switch below), so the frame the run is about to fill is never
  // replaced by a centered line.
  if (state.gate === "loading" && !state.canStart) {
    return <ReviewLoadingView message={state.loadingMessage ?? "Loading review..."} />;
  }

  if (state.gate === "unconfigured") {
    return (
      <ApiKeyMissingView
        productLabel={state.productLabel ?? undefined}
        meta={state.configurationDisplay ?? undefined}
        readiness={state.readiness}
        onGoToSettings={goToProviderSettings}
        onBack={handleGateBack}
      />
    );
  }

  if (state.gate === "no-diff") {
    const currentMode = state.mode;
    const otherMode = getAlternateReviewMode(currentMode);
    const startOtherMode = async () => {
      if (switchingModeRef.current) return;
      switchingModeRef.current = true;
      setIsSwitchingMode(true);
      try {
        const result = await start(otherMode);
        if (result === "setup-required") navigate({ screen: "settings/providers" });
      } finally {
        switchingModeRef.current = false;
        setIsSwitchingMode(false);
      }
    };
    return (
      <NoChangesView
        mode={currentMode}
        disabled={isSwitchingMode}
        onSwitchMode={() => consent.require(() => void startOtherMode())}
        onBack={handleGateBack}
      />
    );
  }

  if (state.startError) {
    return (
      <ReviewTerminalErrorView
        title={state.startError.title}
        error={state.startError.message}
        onBack={handleGateBack}
        recovery={
          state.startError.recovery === "configure-provider"
            ? { label: "Open Providers", open: goToProviderSettings }
            : undefined
        }
      />
    );
  }

  if (isSettledError) {
    const error = state.error ?? "Review failed.";
    const guidance = classifyReviewStreamError(
      error,
      state.errorCode,
      state.transportFamily ?? undefined,
    );
    // "Change model" opens the model dialog on arrival; the other provider
    // recoveries land on the page itself.
    const recovery = isProviderRecoveryError(guidance.kind)
      ? {
          label: guidance.ctaLabel,
          open:
            guidance.kind === "model-incompatible"
              ? () => {
                  reset();
                  navigate({ screen: "settings/providers", intent: "select-model" });
                }
              : goToProviderSettings,
        }
      : undefined;
    // The failure text is what sent the user here — the model, the numbers, and
    // the ceiling it broke — so the picker repeats it instead of paraphrasing.
    const canNarrow = state.errorCode !== null && NARROWABLE_ERROR_CODES.has(state.errorCode);
    return (
      <ReviewTerminalErrorView
        title={guidance.title}
        error={error}
        guidance={guidance.guidance}
        onBack={handleGateBack}
        recovery={recovery}
        onFilterFiles={
          canNarrow ? () => setFileFilter({ origin: "narrow", reason: error }) : undefined
        }
      />
    );
  }

  const sizeWarning = state.sizeWarning;

  switch (state.phase) {
    // The session request is part of the run, not a screen of its own: the
    // steps it is about to walk are already known, so they are drawn pending
    // and fill in as the stream attaches. Escape stays live throughout, which
    // the centered loading frame never offered.
    case "loading":
    case "streaming":
    case "completing":
      return (
        <ReviewProgressView
          progressSteps={mapStepsToProgressDataWithAgents(state.steps, state.agents)}
          agents={state.agents}
          lensStats={state.completion.lensStats}
          events={state.events}
          fileProgress={state.fileProgress}
          isStreaming={state.isStreaming}
          error={state.error}
          errorCode={state.errorCode}
          transportFamily={state.transportFamily}
          notices={state.notices}
          sizeWarning={sizeWarning}
          onFilterFiles={sizeWarning ? () => cancelAndFilterFiles(sizeWarning.message) : undefined}
          onCancel={() => {
            void cancel().then((error) => {
              if (error) {
                return;
              }
              reset();
              navigate({ screen: "home" });
            });
          }}
          // Leaving is offered until the results are on their way: the run keeps
          // going server-side and home resumes it. The completion delay is the
          // one moment with a result about to land, so it holds the screen.
          onBack={state.phase === "completing" ? undefined : handleRunningBack}
          issuesFound={state.issues.length}
          startedAt={state.startedAt}
          completedAt={state.completedAt}
          reviewId={state.reviewId}
          contextSnapshot={state.contextSnapshot}
          contextRefreshError={state.contextRefreshError}
          onRetryContextRefresh={state.retryContextRefresh}
          // Offered only while the completion delay runs: before the run ends
          // there is no deduped result to show.
          onViewResults={state.phase === "completing" ? goToSummary : undefined}
          onGoToSettings={() => navigate({ screen: "settings/providers" })}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          durationMs={
            state.startedAt && state.completedAt
              ? state.completedAt.getTime() - state.startedAt.getTime()
              : undefined
          }
          lensStats={state.completion.lensStats}
          droppedDuplicates={state.completion.droppedDuplicates}
          droppedBelowThreshold={state.completion.droppedBelowThreshold}
          minSeverity={state.completion.minSeverity}
          onContinue={goToResults}
          onBack={handleGateBack}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          lensStats={state.completion.lensStats}
          droppedDuplicates={state.completion.droppedDuplicates}
          onBack={goToSummary}
        />
      );
  }
}
