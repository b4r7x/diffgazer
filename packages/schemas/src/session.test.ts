import { describe, it, expect } from "vitest";
import {
  SessionMessageSchema,
  SessionMetadataSchema,
  SessionSchema,
  CreateSessionRequestSchema,
  AddMessageRequestSchema,
} from "./session.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440001";
const VALID_TIMESTAMP = "2024-01-01T00:00:00.000Z";

function createBaseMessage(overrides = {}) {
  return {
    id: VALID_UUID,
    role: "user",
    content: "Hello, world!",
    createdAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

function createBaseMetadata(overrides = {}) {
  return {
    id: VALID_UUID,
    projectPath: "/home/user/project",
    createdAt: VALID_TIMESTAMP,
    updatedAt: VALID_TIMESTAMP,
    messageCount: 0,
    ...overrides,
  };
}

describe("SessionMessageSchema", () => {
  it.each([
    ["invalid role", { role: "invalid" }],
    ["invalid UUID", { id: "not-a-uuid" }],
    ["invalid datetime", { createdAt: "not-a-date" }],
    ["missing content", { content: undefined }],
  ])("rejects message with %s", (_, overrides) => {
    const result = SessionMessageSchema.safeParse(createBaseMessage(overrides));
    expect(result.success).toBe(false);
  });
});

describe("SessionMetadataSchema", () => {
  it("accepts valid metadata with all fields", () => {
    const metadata = createBaseMetadata({
      title: "Test Session",
      messageCount: 5,
    });
    const result = SessionMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it.each([
    ["negative messageCount", { messageCount: -1 }],
    ["non-integer messageCount", { messageCount: 1.5 }],
  ])("rejects %s", (_, overrides) => {
    const result = SessionMetadataSchema.safeParse(createBaseMetadata(overrides));
    expect(result.success).toBe(false);
  });
});

describe("SessionSchema", () => {
  it("accepts valid complete session", () => {
    const session = {
      metadata: createBaseMetadata({ title: "Test", messageCount: 1 }),
      messages: [createBaseMessage({ id: VALID_UUID_2 })],
    };
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("accepts empty messages array", () => {
    const session = {
      metadata: createBaseMetadata(),
      messages: [],
    };
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("rejects session with invalid message", () => {
    const session = {
      metadata: createBaseMetadata({ messageCount: 1 }),
      messages: [createBaseMessage({ id: "invalid-uuid" })],
    };
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it.each([
    [
      "messageCount less than messages.length",
      { messageCount: 1 },
      [createBaseMessage({ id: VALID_UUID }), createBaseMessage({ id: VALID_UUID_2 })],
    ],
    [
      "messageCount greater than messages.length",
      { messageCount: 5 },
      [createBaseMessage({ id: VALID_UUID })],
    ],
    ["non-zero messageCount with empty messages", { messageCount: 1 }, []],
  ])("rejects session when %s", (_, metadataOverrides, messages) => {
    const session = {
      metadata: createBaseMetadata(metadataOverrides),
      messages,
    };
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "messageCount must match messages.length"
      );
    }
  });

  it("accepts session when messageCount matches messages.length", () => {
    const session = {
      metadata: createBaseMetadata({ messageCount: 2 }),
      messages: [
        createBaseMessage({ id: VALID_UUID }),
        createBaseMessage({ id: VALID_UUID_2 }),
      ],
    };
    const result = SessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });
});

describe("CreateSessionRequestSchema", () => {
  it.each([
    ["with title", { projectPath: "/home/user/project", title: "New Session" }],
    ["without title", { projectPath: "/home/user/project" }],
  ])("accepts valid request %s", (_, request) => {
    const result = CreateSessionRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("rejects request without projectPath", () => {
    const result = CreateSessionRequestSchema.safeParse({ title: "New Session" });
    expect(result.success).toBe(false);
  });
});

describe("AddMessageRequestSchema", () => {
  it.each([
    ["user", { role: "user", content: "Test message" }],
    ["assistant", { role: "assistant", content: "Test message" }],
    ["system", { role: "system", content: "Test message" }],
  ])("accepts valid %s message", (_, request) => {
    const result = AddMessageRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = AddMessageRequestSchema.safeParse({
      role: "invalid",
      content: "Test message",
    });
    expect(result.success).toBe(false);
  });
});
