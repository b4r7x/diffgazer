import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStorageTestContext, createPathsMock, unwrap, delay, UUID_V4_PATTERN } from "../../__test__/testing.js";

const mocks = vi.hoisted(() => ({ testDir: "" }));

vi.mock("./paths.js", async () => ({
  get paths() {
    return createPathsMock(mocks);
  },
}));

let createSession: typeof import("./sessions.js").createSession;
let addMessage: typeof import("./sessions.js").addMessage;
let listSessions: typeof import("./sessions.js").listSessions;
let getLastSession: typeof import("./sessions.js").getLastSession;
let sessionStore: typeof import("./sessions.js").sessionStore;

describe("Session Storage", () => {
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const context = await createStorageTestContext("sessions");
    mocks.testDir = context.testDir;
    cleanup = context.cleanup;

    vi.resetModules();
    const sessionsMod = await import("./sessions.js");
    createSession = sessionsMod.createSession;
    addMessage = sessionsMod.addMessage;
    listSessions = sessionsMod.listSessions;
    getLastSession = sessionsMod.getLastSession;
    sessionStore = sessionsMod.sessionStore;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  describe("createSession", () => {
    it("generates valid UUID v4 and creates readable session", async () => {
      const created = unwrap(await createSession("/test/project", "Test"));
      expect(created.metadata.id).toMatch(UUID_V4_PATTERN);

      const read = unwrap(await sessionStore.read(created.metadata.id));
      expect(read.metadata.title).toBe("Test");
      expect(read.metadata.createdAt).toBe(read.metadata.updatedAt);
    });
  });

  describe("addMessage", () => {
    it("adds message and updates metadata", async () => {
      const session = unwrap(await createSession("/test/project"));
      await addMessage(session.metadata.id, "user", "Hello");

      const read = unwrap(await sessionStore.read(session.metadata.id));
      expect(read.metadata.messageCount).toBe(1);
      expect(read.messages).toHaveLength(1);
    });

    it("sets title from first user message", async () => {
      const session = unwrap(await createSession("/test/project"));
      await addMessage(session.metadata.id, "user", "How do I fix this bug?");

      const read = unwrap(await sessionStore.read(session.metadata.id));
      expect(read.metadata.title).toBe("How do I fix this bug?");
    });

    it("truncates long titles to 50 chars with ellipsis", async () => {
      const session = unwrap(await createSession("/test/project"));
      const longMessage = "This is a very long message that should be truncated when used as the session title";
      await addMessage(session.metadata.id, "user", longMessage);

      const read = unwrap(await sessionStore.read(session.metadata.id));
      expect(read.metadata.title).toBe(longMessage.slice(0, 50) + "...");
      expect(read.metadata.title?.length).toBe(53);
    });

    it("does not override existing title", async () => {
      const session = unwrap(await createSession("/test/project", "Original Title"));
      await addMessage(session.metadata.id, "user", "New message");

      const read = unwrap(await sessionStore.read(session.metadata.id));
      expect(read.metadata.title).toBe("Original Title");
    });

    it("returns error for non-existent session", async () => {
      const result = await addMessage("550e8400-e29b-41d4-a716-446655440000", "user", "Hello");
      expect(result.ok).toBe(false);
    });

    it.each(["user", "assistant", "system"] as const)("accepts %s role", async (role) => {
      const session = unwrap(await createSession("/test/project"));
      const result = await addMessage(session.metadata.id, role, `${role} message`);
      expect(result.ok).toBe(true);
    });
  });

  describe("listSessions", () => {
    it("lists sessions for project", async () => {
      await createSession("/project/a", "Session A1");
      await createSession("/project/b", "Session B1");
      await createSession("/project/a", "Session A2");

      const list = unwrap(await listSessions("/project/a"));
      expect(list.items).toHaveLength(2);
      expect(list.items.map((s) => s.title)).toContain("Session A1");
      expect(list.items.map((s) => s.title)).toContain("Session A2");
    });

    it("returns all sessions when no filter", async () => {
      await createSession("/project/a", "Session A");
      await createSession("/project/b", "Session B");

      const list = unwrap(await listSessions());
      expect(list.items).toHaveLength(2);
    });

    it("returns empty array for no sessions", async () => {
      const list = unwrap(await listSessions("/nonexistent"));
      expect(list.items).toEqual([]);
    });

    it("sorts by updatedAt descending (most recent first)", async () => {
      await createSession("/project", "First");
      await delay(10);
      await createSession("/project", "Second");
      await delay(10);
      await createSession("/project", "Third");

      const list = unwrap(await listSessions("/project"));
      expect(list.items).toHaveLength(3);
      expect(list.items[0]!.title).toBe("Third");
      expect(list.items[1]!.title).toBe("Second");
      expect(list.items[2]!.title).toBe("First");
    });
  });

  describe("getLastSession", () => {
    it("returns most recent session", async () => {
      await createSession("/project", "First");
      await delay(10);
      await createSession("/project", "Second");

      const session = unwrap(await getLastSession("/project"));
      expect(session?.metadata.title).toBe("Second");
    });

    it("returns null for no sessions", async () => {
      const session = unwrap(await getLastSession("/nonexistent"));
      expect(session).toBeNull();
    });
  });

  describe("sessionStore.remove", () => {
    it("removes session from list", async () => {
      const session1 = unwrap(await createSession("/project", "Session 1"));
      await createSession("/project", "Session 2");

      await sessionStore.remove(session1.metadata.id);

      const list = unwrap(await listSessions("/project"));
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.title).toBe("Session 2");
    });
  });
});
