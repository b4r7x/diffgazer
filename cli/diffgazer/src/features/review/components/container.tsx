import { usePageFooter } from "@diffgazer/core/footer";
import {
  convertAgentEventsToLogEntries,
  mapStepsToProgressData,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box, useInput } from "ink";
import { type ReactElement, useEffect, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Spinner } from "../../../components/ui/spinner";
import { useNavigation } from "../../../hooks/use-navigation";
import { useReviewLifecycle } from "../hooks/use-lifecycle";
import { ApiKeyMissingView } from "./api-key-missing-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

interface ReviewContainerProps {
  mode?: ReviewMode;
  reviewId?: string;
  allowResumeWithoutSetup?: boolean;
}

const BACK_SHORTCUTS: Shortcut[] = [{ key: "Esc", label: "Back" }];

function ReviewLoadingView({ message }: { message: string }): ReactElement {
  usePageFooter({ shortcuts: [] });

  return (
    <Box>
      <Spinner label={message} />
    </Box>
  );
}

function ReviewTerminalErrorView({
  error,
  onBack,
}: {
  error: string;
  onBack: () => void;
}): ReactElement {
  usePageFooter({ shortcuts: [], rightShortcuts: BACK_SHORTCUTS });
  useInput(
    (_input, key) => {
      if (key.escape) {
        onBack();
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Callout variant="error">
        <Callout.Title>Review failed</Callout.Title>
        <Callout.Content>{sanitizeTerminalText(error)}</Callout.Content>
      </Callout>
      <Box gap={2}>
        <Button variant="secondary" isActive onPress={onBack}>
          Back
        </Button>
      </Box>
    </Box>
  );
}

export function ReviewContainer({
  mode,
  reviewId,
  allowResumeWithoutSetup = false,
}: ReviewContainerProps): ReactElement {
  const { navigate, goBack } = useNavigation();
  const { state, start, cancel, goToSummary, goToResults, reset } = useReviewLifecycle({
    mode,
    reviewId,
    allowResumeWithoutSetup,
  });

  function handleGateBack() {
    reset({ clearActiveSession: true });
    goBack();
  }

  function handleRunningBack() {
    reset();
    navigate({ screen: "home" });
  }

  const hasStarted = useRef(false);

  useEffect(() => {
    if (mode && !reviewId && state.gate === "running" && !hasStarted.current) {
      hasStarted.current = true;
      void start(mode);
    }
  }, [mode, reviewId, start, state.gate]);

  if (state.gate === "loading") {
    return <ReviewLoadingView message={state.loadingMessage ?? "Loading review..."} />;
  }

  if (state.gate === "unconfigured") {
    return (
      <ApiKeyMissingView
        provider={state.provider ?? undefined}
        missingModel={!state.model}
        onGoToSettings={() => {
          reset();
          navigate({ screen: "settings/providers" });
        }}
        onBack={handleGateBack}
      />
    );
  }

  if (state.gate === "no-diff") {
    const currentMode = state.mode;
    const otherMode = currentMode === "staged" ? "unstaged" : "staged";
    return (
      <NoChangesView
        mode={currentMode}
        onSwitchMode={() => {
          reset({ clearActiveSession: true });
          void start(otherMode);
        }}
        onBack={handleGateBack}
      />
    );
  }

  if (state.gate === "terminal-error") {
    return (
      <ReviewTerminalErrorView error={state.error ?? "Review failed."} onBack={handleGateBack} />
    );
  }

  if (state.error && state.phase !== "streaming" && state.phase !== "completing") {
    return <ReviewTerminalErrorView error={state.error} onBack={handleGateBack} />;
  }

  switch (state.phase) {
    case "loading":
      return <ReviewLoadingView message="Starting review..." />;

    case "streaming":
    case "completing":
      return (
        <ReviewProgressView
          progressSteps={mapStepsToProgressData(state.steps, state.agents)}
          agents={state.agents}
          logEntries={convertAgentEventsToLogEntries(state.events)}
          fileProgress={state.fileProgress}
          isStreaming={state.phase === "streaming"}
          error={state.error}
          notices={state.notices}
          onCancel={() => {
            void cancel().then((error) => {
              if (error) {
                return;
              }
              reset();
              navigate({ screen: "home" });
            });
          }}
          onBack={state.phase === "streaming" ? handleRunningBack : undefined}
          issuesFound={state.issues.length}
          startedAt={state.startedAt}
          reviewId={state.reviewId}
          contextSnapshot={state.contextSnapshot}
          onViewResults={goToSummary}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          durationMs={state.startedAt ? Date.now() - state.startedAt.getTime() : undefined}
          onContinue={goToResults}
          onBack={handleGateBack}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          onBack={goToSummary}
        />
      );
  }
}
