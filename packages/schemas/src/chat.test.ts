import { describe, it, expect } from "vitest";
import { ChatErrorSchema, ChatStreamEventSchema } from "./chat.js";

describe("ChatErrorSchema", () => {
  it.each([
    ["SESSION_NOT_FOUND", "SESSION_NOT_FOUND"],
    ["AI_ERROR", "AI_ERROR"],
    ["STREAM_ERROR", "STREAM_ERROR"],
  ])("accepts chat-specific error code: %s", (_, code) => {
    const result = ChatErrorSchema.safeParse({
      message: "Error occurred",
      code,
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["INTERNAL_ERROR", "INTERNAL_ERROR"],
    ["API_KEY_MISSING", "API_KEY_MISSING"],
    ["RATE_LIMITED", "RATE_LIMITED"],
  ])("accepts shared error code: %s", (_, code) => {
    const result = ChatErrorSchema.safeParse({
      message: "Error occurred",
      code,
    });
    expect(result.success).toBe(true);
  });

  it("accepts error with detailed message", () => {
    const result = ChatErrorSchema.safeParse({
      message: "Session with ID abc123 was not found in the database",
      code: "SESSION_NOT_FOUND",
    });
    expect(result.success).toBe(true);
  });

  it("accepts error with empty message", () => {
    const result = ChatErrorSchema.safeParse({
      message: "",
      code: "AI_ERROR",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["missing message", { code: "SESSION_NOT_FOUND" }],
    ["missing code", { message: "Error occurred" }],
  ])("rejects error with %s", (_, partial) => {
    const result = ChatErrorSchema.safeParse(partial);
    expect(result.success).toBe(false);
  });

  it("rejects error with invalid code", () => {
    const result = ChatErrorSchema.safeParse({
      message: "Error occurred",
      code: "INVALID_CODE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects error with non-chat error code", () => {
    const result = ChatErrorSchema.safeParse({
      message: "Error occurred",
      code: "NOT_FOUND",
    });
    expect(result.success).toBe(false);
  });
});

describe("ChatStreamEventSchema", () => {
  it("accepts chunk event with content", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "chunk",
      content: "Hello, this is a response chunk",
    });
    expect(result.success).toBe(true);
  });

  it("accepts chunk event with empty content", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "chunk",
      content: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts chunk event with special characters", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "chunk",
      content: "Special chars: \n\t\r <>&",
    });
    expect(result.success).toBe(true);
  });

  it("accepts complete event without truncated field", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "complete",
      content: "Full response content",
    });
    expect(result.success).toBe(true);
  });

  it("accepts complete event with truncated false", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "complete",
      content: "Full response content",
      truncated: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts complete event with truncated true", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "complete",
      content: "Partial response...",
      truncated: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts complete event with empty content", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "complete",
      content: "",
      truncated: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts error event with chat error", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "Session not found",
        code: "SESSION_NOT_FOUND",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts error event with AI error", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "AI provider returned an error",
        code: "AI_ERROR",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts error event with stream error", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "Stream was interrupted",
        code: "STREAM_ERROR",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts error event with shared error code", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects event with invalid type", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "invalid",
      content: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects chunk event without content", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "chunk",
    });
    expect(result.success).toBe(false);
  });

  it("rejects complete event without content", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "complete",
      truncated: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects complete event with non-boolean truncated", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "complete",
      content: "test",
      truncated: "false",
    });
    expect(result.success).toBe(false);
  });

  it("rejects error event without error field", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
    });
    expect(result.success).toBe(false);
  });

  it("rejects error event with invalid error", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
      error: {
        code: "SESSION_NOT_FOUND",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects error event with invalid error code", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "Error occurred",
        code: "INVALID_CODE",
      },
    });
    expect(result.success).toBe(false);
  });

  it("discriminates between event types correctly", () => {
    const chunk = ChatStreamEventSchema.safeParse({
      type: "chunk",
      content: "test",
    });
    expect(chunk.success).toBe(true);
    if (chunk.success) {
      expect(chunk.data.type).toBe("chunk");
    }

    const complete = ChatStreamEventSchema.safeParse({
      type: "complete",
      content: "test",
    });
    expect(complete.success).toBe(true);
    if (complete.success) {
      expect(complete.data.type).toBe("complete");
    }

    const error = ChatStreamEventSchema.safeParse({
      type: "error",
      error: { message: "Error", code: "AI_ERROR" },
    });
    expect(error.success).toBe(true);
    if (error.success) {
      expect(error.data.type).toBe("error");
    }
  });

  it("accepts extra fields in event (Zod allows passthrough)", () => {
    const result = ChatStreamEventSchema.safeParse({
      type: "chunk",
      content: "test",
      extraField: "ignored",
    });
    expect(result.success).toBe(true);
  });
});
