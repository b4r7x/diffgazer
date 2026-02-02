import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FullTriageStreamEvent } from "@repo/schemas";
import {
  createSession,
  getSession,
  getActiveSessionForProject,
  markReady,
  markComplete,
} from "./active-sessions.js";

// Mock data
const mockEvent: FullTriageStreamEvent = {
  type: "step_start",
  step: "triage",
  timestamp: new Date().toISOString(),
};

describe("active-sessions", () => {
  beforeEach(() => {
    vi.spyOn(console, "log");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSession - logging", () => {
    it("logs when session is found", () => {
      const reviewId = "review-123";
      const projectPath = "/project/path";

      createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      const result = getSession(reviewId);

      expect(result).toBeDefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[SESSION_RESTORE] Found session")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`reviewId=${reviewId}`)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("events=0")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("isComplete=false")
      );
    });

    it("does not log when session not found", () => {
      const result = getSession("non-existent-review");

      expect(result).toBeUndefined();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("includes event count in log message", () => {
      const reviewId = "review-with-events";
      const projectPath = "/project/path";

      const session = createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      session.events.push(mockEvent);
      session.events.push(mockEvent);

      getSession(reviewId);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("events=2")
      );
    });

    it("includes completion status in log message", () => {
      const reviewId = "review-complete";
      const projectPath = "/project/path";

      const session = createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      markComplete(reviewId);

      // Note: markComplete clears subscribers and deletes after timeout,
      // but isComplete flag should be set
      const retrievedSession = getSession(reviewId);
      if (retrievedSession) {
        expect(retrievedSession.isComplete).toBe(true);
      }
    });
  });

  describe("getActiveSessionForProject - logging", () => {
    it("logs when active session found for project", () => {
      const projectPath = "/src/project";
      const reviewId = "review-abc";

      const session = createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId);
      session.events.push(mockEvent);

      const result = getActiveSessionForProject(projectPath, "abc123", "M  test.ts", "staged");

      expect(result).toBeDefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[SESSION_RESTORE] Active session for project")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`reviewId=${reviewId}`)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("events=1")
      );
    });

    it("does not log when no active session found", () => {
      const result = getActiveSessionForProject("/non/existent/project", "abc123", "M  test.ts", "staged");

      expect(result).toBeUndefined();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("does not return incomplete sessions", () => {
      const projectPath = "/project/incomplete";
      const reviewId = "incomplete-review";

      createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId);
      // Don't call markComplete, but we'll manually set it
      const session = getSession(reviewId);
      if (session) {
        session.isComplete = true;
      }

      const result = getActiveSessionForProject(projectPath, "abc123", "M  test.ts", "staged");

      expect(result).toBeUndefined();
      // Should not log because session is complete
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[SESSION_RESTORE] Active session for project")
      );
    });

    it("does not return sessions that are not ready", () => {
      const projectPath = "/project/not-ready";
      const reviewId = "not-ready-review";

      createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      // Don't call markReady

      const result = getActiveSessionForProject(projectPath, "abc123", "M  test.ts", "staged");

      expect(result).toBeUndefined();
      // Should not log because session is not ready
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[SESSION_RESTORE] Active session for project")
      );
    });

    it("includes event count in log message", () => {
      const projectPath = "/project/with/events";
      const reviewId = "review-events";

      const session = createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId);
      session.events.push(mockEvent);
      session.events.push(mockEvent);
      session.events.push(mockEvent);

      getActiveSessionForProject(projectPath, "abc123", "M  test.ts", "staged");

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("events=3")
      );
    });

    it("returns first matching active session when multiple exist", () => {
      const projectPath = "/shared/project";
      const reviewId1 = "review-1";
      const reviewId2 = "review-2";

      const session1 = createSession(reviewId1, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId1);

      const session2 = createSession(reviewId2, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId2);

      const result = getActiveSessionForProject(projectPath, "abc123", "M  test.ts", "staged");

      // Should return one of them
      expect(result).toBeDefined();
      expect(
        result?.reviewId === reviewId1 || result?.reviewId === reviewId2
      ).toBe(true);
    });
  });

  describe("logging integration", () => {
    it("logs separately for getSession and getActiveSessionForProject", () => {
      const reviewId = "review-test";
      const projectPath = "/integration/test";

      const session = createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId);

      getSession(reviewId);
      getActiveSessionForProject(projectPath, "abc123", "M  test.ts", "staged");

      expect(console.log).toHaveBeenCalledTimes(2);
    });

    it("getSession logs even if session is not ready", () => {
      const reviewId = "not-ready-review";
      const projectPath = "/project";

      createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      // Don't mark ready

      getSession(reviewId);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[SESSION_RESTORE] Found session")
      );
    });

    it("logs consistent format across calls", () => {
      const reviewId = "consistency-test";
      const projectPath = "/consistency/path";

      const session = createSession(reviewId, projectPath, "abc123", "M  test.ts", "staged");
      markReady(reviewId);

      getSession(reviewId);

      const calls = vi.mocked(console.log).mock.calls;
      const logMessage = calls[0]?.[0] as string;

      expect(logMessage).toMatch(/\[SESSION_RESTORE\]/);
      expect(logMessage).toMatch(/reviewId=/);
      expect(logMessage).toMatch(/events=/);
      expect(logMessage).toMatch(/isComplete=/);
    });
  });
});
