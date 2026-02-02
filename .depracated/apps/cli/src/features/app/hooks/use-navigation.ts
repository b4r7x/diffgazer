import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useInput, useApp } from "ink";
import { useSessionRecorderContext } from "../../../hooks/index.js";
import { type AppView } from "../../../types/index.js";

export type { AppView };

interface ViewActions {
  gitStatus: {
    fetch: (queryParams?: Record<string, string>) => Promise<unknown>;
    reset: () => void;
  };
  gitDiff: {
    fetch: (staged?: boolean) => Promise<unknown>;
    reset: () => void;
  };
  review: {
    startReview: (staged?: boolean, chunked?: boolean) => Promise<unknown>;
    reset: () => void;
  };
  config: {
    loadSettings: () => Promise<unknown>;
    checkState: string;
  };
  reviewHistory: {
    listReviews: () => Promise<unknown>;
    reset: () => void;
    currentReview: unknown | null;
  };
  session: {
    listSessions: () => Promise<unknown>;
    currentSession: unknown | null;
  };
  chat: {
    reset: () => void;
  };
  onDiscussReview: () => Promise<void>;
}

interface DiffState {
  staged: boolean;
  setStaged: (staged: boolean) => void;
}

interface ReviewState {
  staged: boolean;
  setStaged: (staged: boolean) => void;
}

interface UseNavigationResult {
  view: AppView;
  setView: (view: AppView) => void;
  diffState: DiffState;
  reviewState: ReviewState;
  navigateToChat: () => void;
}

type InputKey = { escape: boolean };
type InputHandler = (input: string, key: InputKey) => void;
type KeyActionMap = Record<string, () => void>;

const PASSIVE_VIEWS: ReadonlySet<AppView> = new Set<AppView>([
  "loading",
  "trust-wizard",
  "onboarding",
  "history",
  "main",
  "settings-hub",
  "settings-trust",
  "settings-theme",
  "settings-providers",
  "settings-diagnostics",
]);

function createKeyHandler(keyActions: KeyActionMap): InputHandler {
  return (input: string) => {
    const action = keyActions[input];
    if (action) action();
  };
}

function createKeyHandlerWithBack(
  keyActions: KeyActionMap,
  onBack: () => void
): InputHandler {
  return (input: string, key: InputKey) => {
    if (key.escape || input === "b") {
      onBack();
      return;
    }
    const action = keyActions[input];
    if (action) action();
  };
}

export function useNavigation(actions: ViewActions): UseNavigationResult {
  const { exit } = useApp();
  const [view, setView] = useState<AppView>("loading");
  const [diffStaged, setDiffStaged] = useState(false);
  const [reviewStaged, setReviewStaged] = useState(true);

  const recorderContext = useSessionRecorderContext();
  const prevViewRef = useRef<AppView>(view);

  useEffect(() => {
    if (prevViewRef.current !== view && view !== "loading") {
      recorderContext.recordEvent("NAVIGATE", {
        from: prevViewRef.current,
        to: view,
      });
    }
    prevViewRef.current = view;
  }, [view, recorderContext]);

  const handleMainInput = useCallback<InputHandler>(
    (input) => {
      const mainKeyActions: KeyActionMap = {
        g: () => {
          setView("git-status");
          void actions.gitStatus.fetch();
        },
        d: () => {
          setView("git-diff");
          setDiffStaged(false);
          void actions.gitDiff.fetch(false);
        },
        r: () => {
          setView("review");
          setReviewStaged(true);
          recorderContext.recordEvent("RUN_CREATED", {
            staged: true,
            startedAt: new Date().toISOString(),
          });
          void actions.review.startReview(true);
        },
        S: () => {
          void actions.config.loadSettings();
          setView("settings-hub");
        },
        h: () => {
          void actions.reviewHistory.listReviews();
          void actions.session.listSessions();
          setView("history");
        },
        c: () => {
          if (actions.session.currentSession) {
            setView("chat");
          }
        },
      };
      createKeyHandler(mainKeyActions)(input, { escape: false });
    },
    [actions]
  );

  const handleGitStatusInput = useCallback<InputHandler>(
    (input, key) => {
      createKeyHandlerWithBack(
        { r: () => void actions.gitStatus.fetch() },
        () => {
          setView("main");
          actions.gitStatus.reset();
        }
      )(input, key);
    },
    [actions.gitStatus]
  );

  const handleGitDiffInput = useCallback<InputHandler>(
    (input, key) => {
      createKeyHandlerWithBack(
        {
          r: () => void actions.gitDiff.fetch(diffStaged),
          s: () => {
            const next = !diffStaged;
            setDiffStaged(next);
            void actions.gitDiff.fetch(next);
          },
        },
        () => {
          setView("main");
          actions.gitDiff.reset();
        }
      )(input, key);
    },
    [actions.gitDiff, diffStaged]
  );

  const handleReviewInput = useCallback<InputHandler>(
    (input, key) => {
      createKeyHandlerWithBack(
        {
          r: () => void actions.review.startReview(reviewStaged),
          s: () => {
            const next = !reviewStaged;
            setReviewStaged(next);
            void actions.review.startReview(next);
          },
        },
        () => {
          setView("main");
          actions.review.reset();
        }
      )(input, key);
    },
    [actions.review, reviewStaged]
  );

  const handleChatInput = useCallback<InputHandler>(
    (input, key) => {
      createKeyHandlerWithBack({}, () => {
        actions.chat.reset();
        setView("main");
      })(input, key);
    },
    [actions.chat]
  );

  const handleSettingsInput = useCallback<InputHandler>(() => {
    if (actions.config.checkState === "unconfigured") {
      setView("onboarding");
    }
  }, [actions.config.checkState]);

  const viewHandlers = useMemo<Partial<Record<AppView, InputHandler>>>(
    () => ({
      main: handleMainInput,
      "git-status": handleGitStatusInput,
      "git-diff": handleGitDiffInput,
      review: handleReviewInput,
      chat: handleChatInput,
      settings: handleSettingsInput,
    }),
    [
      handleMainInput,
      handleGitStatusInput,
      handleGitDiffInput,
      handleReviewInput,
      handleChatInput,
      handleSettingsInput,
    ]
  );

  useInput((input, key) => {
    if (input === "q" && view !== "loading" && view !== "main") {
      exit();
      return;
    }

    if (PASSIVE_VIEWS.has(view)) {
      return;
    }

    viewHandlers[view]?.(input, key);
  });

  const diffState = useMemo<DiffState>(
    () => ({
      staged: diffStaged,
      setStaged: setDiffStaged,
    }),
    [diffStaged]
  );

  const reviewState = useMemo<ReviewState>(
    () => ({
      staged: reviewStaged,
      setStaged: setReviewStaged,
    }),
    [reviewStaged]
  );

  const navigateToChat = useCallback(() => setView("chat"), []);

  return {
    view,
    setView,
    diffState,
    reviewState,
    navigateToChat,
  };
}
