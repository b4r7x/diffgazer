import { useEffect, useState } from "react";
import type { SessionMode } from "../../../types/index.js";
import type { ConfigCheckState, SaveConfigState, TrustLoadState, TrustSaveState } from "../../../hooks/index.js";
import type { AppView } from "./use-navigation.js";

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

interface TrustActions {
  checkTrust: (projectId: string) => Promise<boolean>;
  loadState: TrustLoadState;
  saveState: TrustSaveState;
}

interface UseAppInitOptions {
  config: ConfigActions;
  trust: TrustActions;
  projectId: string;
  sessionMode: SessionMode;
  sessionId?: string;
  sessionActions: SessionActions;
  setView: (view: AppView) => void;
}

type InitPhase = "checking-trust" | "checking-config" | "ready";

export function useAppInit({
  config,
  trust,
  projectId,
  sessionMode,
  sessionId,
  sessionActions,
  setView,
}: UseAppInitOptions): void {
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [initPhase, setInitPhase] = useState<InitPhase>("checking-trust");
  const [isTrusted, setIsTrusted] = useState<boolean | null>(null);
  const [configCheckTriggered, setConfigCheckTriggered] = useState(false);

  useEffect(() => {
    if (initPhase !== "checking-trust") return;

    void trust.checkTrust(projectId).then((trusted) => {
      setIsTrusted(trusted);
      if (!trusted) {
        setView("trust-wizard");
        setInitPhase("ready");
      } else {
        setInitPhase("checking-config");
      }
    });
  }, [initPhase, projectId, trust.checkTrust, setView]);

  useEffect(() => {
    if (initPhase !== "checking-config") return;
    if (configCheckTriggered) return;

    setConfigCheckTriggered(true);
    void config.checkConfig();
  }, [initPhase, config.checkConfig, configCheckTriggered]);

  useEffect(() => {
    if (initPhase !== "checking-config") return;

    if (config.checkState === "configured") {
      setView("main");
      setInitPhase("ready");
    } else if (config.checkState === "unconfigured" || config.checkState === "error") {
      setView("onboarding");
      setInitPhase("ready");
    }
  }, [initPhase, config.checkState, setView]);

  useEffect(() => {
    if (config.saveState === "success") {
      setView("main");
    }
  }, [config.saveState, setView]);

  useEffect(() => {
    if (trust.saveState === "success" && isTrusted === false) {
      setIsTrusted(true);
      setConfigCheckTriggered(false);
      setInitPhase("checking-config");
    }
  }, [trust.saveState, isTrusted]);

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
