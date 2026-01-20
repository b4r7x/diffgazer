import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import { GitStatusDisplay } from "../components/git-status-display.js";
import { GitDiffDisplay } from "../components/git-diff-display.js";
import { ReviewDisplay } from "../components/review-display.js";
import { OnboardingScreen } from "./screens/onboarding-screen.js";
import { SettingsScreen } from "./screens/settings-screen.js";
import { useGitStatus } from "../hooks/use-git-status.js";
import { useGitDiff } from "../hooks/use-git-diff.js";
import { useReview } from "../hooks/use-review.js";
import { useConfig } from "../hooks/use-config.js";

type View =
  | "loading"
  | "onboarding"
  | "main"
  | "git-status"
  | "git-diff"
  | "review"
  | "settings";

interface AppProps {
  address: string;
}

export function App({ address }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("loading");
  const gitStatus = useGitStatus();
  const gitDiff = useGitDiff();
  const review = useReview();
  const config = useConfig();
  const [diffStaged, setDiffStaged] = useState(false);
  const [reviewStaged, setReviewStaged] = useState(true);

  useEffect(() => {
    void config.checkConfig();
  }, []);

  useEffect(() => {
    if (config.checkState === "configured" || config.saveState === "success") {
      setView("main");
    } else if (
      config.checkState === "unconfigured" ||
      config.checkState === "error"
    ) {
      setView("onboarding");
    }
  }, [config.checkState, config.saveState]);

  useInput((input, key) => {
    if (input === "q" && view !== "loading") {
      exit();
      return;
    }

    if (view === "loading" || view === "onboarding") {
      return;
    }

    if (view === "main") {
      if (input === "g") {
        setView("git-status");
        void gitStatus.fetch();
      }
      if (input === "d") {
        setView("git-diff");
        setDiffStaged(false);
        void gitDiff.fetch(false);
      }
      if (input === "r") {
        setView("review");
        setReviewStaged(true);
        void review.startReview(true);
      }
      if (input === "S") {
        void config.loadSettings();
        setView("settings");
      }
      return;
    }

    if (view === "git-status") {
      if (input === "r") {
        void gitStatus.fetch();
      }
      if (input === "b" || key.escape) {
        setView("main");
        gitStatus.reset();
      }
      return;
    }

    if (view === "git-diff") {
      if (input === "r") {
        void gitDiff.fetch(diffStaged);
      }
      if (input === "s") {
        const next = !diffStaged;
        setDiffStaged(next);
        void gitDiff.fetch(next);
      }
      if (input === "b" || key.escape) {
        setView("main");
        gitDiff.reset();
      }
      return;
    }

    if (view === "review") {
      if (input === "r") {
        void review.startReview(reviewStaged);
      }
      if (input === "s") {
        const next = !reviewStaged;
        setReviewStaged(next);
        void review.startReview(next);
      }
      if (input === "b" || key.escape) {
        setView("main");
        review.reset();
      }
      return;
    }

    if (view === "settings") {
      if (config.checkState === "unconfigured") {
        setView("onboarding");
      }
      return;
    }
  });

  if (view === "loading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Stargazer
        </Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Checking configuration...</Text>
        </Box>
      </Box>
    );
  }

  if (view === "onboarding") {
    return (
      <OnboardingScreen
        saveState={config.saveState}
        error={config.error}
        onSave={(provider, apiKey, model) =>
          void config.saveConfig(provider, apiKey, model)
        }
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Stargazer
      </Text>
      <Text>
        Server: <Text color="blue">{address}</Text>
      </Text>
      <Text color="green">Running</Text>

      {view === "main" && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            [g] Git Status [d] Git Diff [r] AI Review [S] Settings [q] Quit
          </Text>
        </Box>
      )}

      {view === "git-status" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Git Status</Text>
          <GitStatusDisplay state={gitStatus.state} />
          <Box marginTop={1}>
            <Text dimColor>[r] Refresh [b] Back [q] Quit</Text>
          </Box>
        </Box>
      )}

      {view === "git-diff" && (
        <Box flexDirection="column" marginTop={1}>
          <GitDiffDisplay state={gitDiff.state} staged={diffStaged} />
          <Box marginTop={1}>
            <Text dimColor>
              [s] Toggle {diffStaged ? "unstaged" : "staged"} [r] Refresh [b]
              Back [q] Quit
            </Text>
          </Box>
        </Box>
      )}

      {view === "review" && (
        <Box flexDirection="column" marginTop={1}>
          <ReviewDisplay state={review.state} staged={reviewStaged} />
          <Box marginTop={1}>
            <Text dimColor>
              [s] Toggle {reviewStaged ? "unstaged" : "staged"} [r] Refresh [b]
              Back [q] Quit
            </Text>
          </Box>
        </Box>
      )}

      {view === "settings" && (
        <Box flexDirection="column" marginTop={1}>
          <SettingsScreen
            provider={config.currentConfig?.provider ?? "Unknown"}
            model={config.currentConfig?.model}
            settingsState={config.settingsState}
            deleteState={config.deleteState}
            error={config.error}
            onDelete={() => void config.deleteConfig()}
            onBack={() => setView("main")}
          />
        </Box>
      )}
    </Box>
  );
}
