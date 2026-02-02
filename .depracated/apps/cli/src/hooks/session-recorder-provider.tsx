import React, { type ReactNode } from "react";
import { SessionRecorderContext, useSessionRecorder } from "./use-session-recorder.js";

interface SessionRecorderProviderProps {
  projectId: string;
  children: ReactNode;
}

export function SessionRecorderProvider({
  projectId,
  children,
}: SessionRecorderProviderProps): React.ReactElement {
  const { sessionId, recordEvent } = useSessionRecorder(projectId);

  return (
    <SessionRecorderContext.Provider value={{ sessionId, recordEvent }}>
      {children}
    </SessionRecorderContext.Provider>
  );
}
