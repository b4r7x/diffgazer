import { useEffect, useState, useCallback } from "react";
import type { SessionMode } from "../../../types/index.js";
import type { ConfigCheckState, SaveConfigState } from "../../../hooks/index.js";
import type { View } from "./use-navigation.js";

interface SessionActions {
  continueLastSession: () => Promise<unknown>;
  loadSession: (id: string) => Promise<unknown>;
  listSessions: () => Promise<unknown>;
  createSession: (title?: string) => Promise<unknown>;
}

interface ConfigActions {
  checkConfig: () => Promise<unknown>;
  checkState: ConfigCheckState;
  saveState: SaveConfigState;
}

interface UseAppInitOptions {
  config: ConfigActions;
  sessionMode: SessionMode;
  sessionId?: string;
  sessionActions: SessionActions;
  setView: (view: View) => void;
}

export function useAppInit({
  config,
  sessionMode,
  sessionId,
  sessionActions,
  setView,
}: UseAppInitOptions): void {
  const [sessionInitialized, setSessionInitialized] = useState(false);

  useEffect(() => {
    void config.checkConfig();
  }, []);

  useEffect(() => {
    if (config.checkState === "configured" || config.saveState === "success") {
      setView("main");
    } else if (config.checkState === "unconfigured" || config.checkState === "error") {
      setView("onboarding");
    }
  }, [config.checkState, config.saveState, setView]);

  useEffect(() => {
    if (config.checkState !== "configured" || sessionInitialized) return;

    setSessionInitialized(true);

    if (sessionMode === "continue") {
      void sessionActions.continueLastSession();
    } else if (sessionMode === "resume" && sessionId) {
      void sessionActions.loadSession(sessionId);
    } else if (sessionMode === "picker") {
      void sessionActions.listSessions();
      setView("sessions");
    } else {
      void sessionActions.createSession();
    }
  }, [config.checkState, sessionMode, sessionId, sessionInitialized, sessionActions, setView]);
}
