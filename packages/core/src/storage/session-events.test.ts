import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionEvent } from "@repo/schemas/session";

let testDir: string;
let appendEvent: typeof import("./session-events.js").appendEvent;
let loadEvents: typeof import("./session-events.js").loadEvents;
let createEventSession: typeof import("./session-events.js").createEventSession;
let listEventSessions: typeof import("./session-events.js").listEventSessions;
let getLatestSession: typeof import("./session-events.js").getLatestSession;

vi.mock("node:os", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:os")>();
  return {
    ...original,
    homedir: () => testDir,
  };
});

describe("Session Events Storage", () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "stargazer-session-events-"));
    await mkdir(join(testDir, ".stargazer", "sessions"), { recursive: true });

    vi.resetModules();
    const mod = await import("./session-events.js");
    appendEvent = mod.appendEvent;
    loadEvents = mod.loadEvents;
    createEventSession = mod.createEventSession;
    listEventSessions = mod.listEventSessions;
    getLatestSession = mod.getLatestSession;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(testDir, { recursive: true, force: true });
  });

  describe("createEventSession", () => {
    it("creates a new session with timestamp-based ID", async () => {
      const result = await createEventSession();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatch(/^\d+-[a-z0-9]+$/);
      }
    });

    it("creates session for specific project", async () => {
      const projectId = "test-project";
      await mkdir(join(testDir, ".stargazer", "projects", projectId, "sessions"), {
        recursive: true,
      });

      const result = await createEventSession(projectId);
      expect(result.ok).toBe(true);
    });
  });

  describe("appendEvent", () => {
    it("appends event to session file", async () => {
      const sessionResult = await createEventSession();
      expect(sessionResult.ok).toBe(true);
      if (!sessionResult.ok) return;

      const sessionId = sessionResult.value;
      const event: SessionEvent = {
        ts: Date.now(),
        type: "NAVIGATE",
        payload: { screen: "review" },
      };

      const appendResult = await appendEvent(sessionId, event);
      expect(appendResult.ok).toBe(true);

      const loadResult = await loadEvents(sessionId);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value).toHaveLength(1);
        expect(loadResult.value[0]?.type).toBe("NAVIGATE");
      }
    });

    it("appends multiple events in order", async () => {
      const sessionResult = await createEventSession();
      expect(sessionResult.ok).toBe(true);
      if (!sessionResult.ok) return;

      const sessionId = sessionResult.value;
      const events: SessionEvent[] = [
        { ts: 1000, type: "NAVIGATE", payload: { screen: "home" } },
        { ts: 2000, type: "OPEN_ISSUE", payload: { issueId: "issue-1" } },
        { ts: 3000, type: "APPLY_PATCH", payload: { issueId: "issue-1" } },
      ];

      for (const event of events) {
        await appendEvent(sessionId, event);
      }

      const loadResult = await loadEvents(sessionId);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value).toHaveLength(3);
        expect(loadResult.value.map((e) => e.type)).toEqual([
          "NAVIGATE",
          "OPEN_ISSUE",
          "APPLY_PATCH",
        ]);
      }
    });

    it("creates session file if it does not exist", async () => {
      const sessionId = Date.now() + "-newfile";
      const event: SessionEvent = {
        ts: Date.now(),
        type: "RUN_CREATED",
        payload: { runId: "run-1" },
      };

      const result = await appendEvent(sessionId, event);
      expect(result.ok).toBe(true);

      const loadResult = await loadEvents(sessionId);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.value).toHaveLength(1);
      }
    });
  });

  describe("loadEvents", () => {
    it("returns NOT_FOUND error for non-existent session", async () => {
      const result = await loadEvents("nonexistent-session");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("skips malformed lines gracefully", async () => {
      const sessionId = Date.now() + "-malformed";
      const filePath = join(testDir, ".stargazer", "sessions", sessionId + ".jsonl");

      const content = [
        JSON.stringify({ ts: 1000, type: "NAVIGATE", payload: {} }),
        "not valid json",
        JSON.stringify({ ts: 2000, type: "OPEN_ISSUE", payload: {} }),
        "{ incomplete json",
        JSON.stringify({ ts: 3000, type: "APPLY_PATCH", payload: {} }),
      ].join("\n");

      await writeFile(filePath, content);

      const result = await loadEvents(sessionId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
      }
    });

    it("handles empty file", async () => {
      const sessionId = Date.now() + "-empty";
      const filePath = join(testDir, ".stargazer", "sessions", sessionId + ".jsonl");
      await writeFile(filePath, "");

      const result = await loadEvents(sessionId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it("validates events against schema", async () => {
      const sessionId = Date.now() + "-invalid-schema";
      const filePath = join(testDir, ".stargazer", "sessions", sessionId + ".jsonl");

      const content = [
        JSON.stringify({ ts: 1000, type: "NAVIGATE", payload: {} }),
        JSON.stringify({ ts: 2000, type: "INVALID_TYPE", payload: {} }),
        JSON.stringify({ ts: "not-a-number", type: "OPEN_ISSUE", payload: {} }),
      ].join("\n");

      await writeFile(filePath, content);

      const result = await loadEvents(sessionId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]?.type).toBe("NAVIGATE");
      }
    });
  });

  describe("listEventSessions", () => {
    it("returns empty array when no sessions exist", async () => {
      const result = await listEventSessions();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it("lists all sessions with metadata", async () => {
      const session1 = await createEventSession();
      const session2 = await createEventSession();

      expect(session1.ok && session2.ok).toBe(true);
      if (!session1.ok || !session2.ok) return;

      await appendEvent(session1.value, { ts: 1000, type: "NAVIGATE", payload: {} });
      await appendEvent(session1.value, { ts: 2000, type: "OPEN_ISSUE", payload: {} });
      await appendEvent(session2.value, { ts: 3000, type: "RUN_CREATED", payload: {} });

      const result = await listEventSessions();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const sessions = result.value;
        const s1 = sessions.find((s) => s.sessionId === session1.value);
        const s2 = sessions.find((s) => s.sessionId === session2.value);
        expect(s1?.eventCount).toBe(2);
        expect(s2?.eventCount).toBe(1);
      }
    });

    it("sorts sessions by creation time descending", async () => {
      const session1 = await createEventSession();
      expect(session1.ok).toBe(true);
      if (!session1.ok) return;
      await appendEvent(session1.value, { ts: 1000, type: "NAVIGATE", payload: {} });

      await new Promise((r) => setTimeout(r, 10));

      const session2 = await createEventSession();
      expect(session2.ok).toBe(true);
      if (!session2.ok) return;
      await appendEvent(session2.value, { ts: 2000, type: "NAVIGATE", payload: {} });

      const result = await listEventSessions();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.sessionId).toBe(session2.value);
        expect(result.value[1]?.sessionId).toBe(session1.value);
      }
    });
  });

  describe("getLatestSession", () => {
    it("returns null when no sessions exist", async () => {
      const result = await getLatestSession("test-project");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it("returns most recently modified session", async () => {
      const projectId = "test-project";
      const projectDir = join(testDir, ".stargazer", "projects", projectId, "sessions");
      await mkdir(projectDir, { recursive: true });

      const session1 = await createEventSession(projectId);
      await new Promise((r) => setTimeout(r, 50));
      const session2 = await createEventSession(projectId);

      expect(session1.ok && session2.ok).toBe(true);
      if (!session1.ok || !session2.ok) return;

      await appendEvent(session2.value, { ts: Date.now(), type: "NAVIGATE", payload: {} }, projectId);

      const result = await getLatestSession(projectId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(session2.value);
      }
    });
  });
});
