import { describe, it, expect } from "vitest";
import {
  ErrorCode,
  ErrorCodeSchema,
  UuidSchema,
  createDomainErrorCodes,
  createDomainErrorSchema,
  ChunkEventSchema,
  ErrorEventSchema,
  createStreamEventSchema,
  SHARED_ERROR_CODES,
  type SharedErrorCode,
} from "./errors.js";
import { VALID_UUID } from "../__test__/testing.js";
import { z } from "zod";

describe("ErrorCode", () => {
  it("includes all expected error codes", () => {
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCode.AI_ERROR).toBe("AI_ERROR");
    expect(ErrorCode.AI_CLIENT_ERROR).toBe("AI_CLIENT_ERROR");
    expect(ErrorCode.API_KEY_MISSING).toBe("API_KEY_MISSING");
    expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(ErrorCode.STREAM_ERROR).toBe("STREAM_ERROR");
    expect(ErrorCode.CONFIG_NOT_FOUND).toBe("CONFIG_NOT_FOUND");
    expect(ErrorCode.GIT_NOT_FOUND).toBe("GIT_NOT_FOUND");
    expect(ErrorCode.NOT_GIT_REPO).toBe("NOT_GIT_REPO");
    expect(ErrorCode.COMMAND_FAILED).toBe("COMMAND_FAILED");
    expect(ErrorCode.INVALID_PATH).toBe("INVALID_PATH");
  });
});

describe("ErrorCodeSchema", () => {
  it.each([
    "INTERNAL_ERROR",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "AI_ERROR",
    "AI_CLIENT_ERROR",
    "API_KEY_MISSING",
    "RATE_LIMITED",
    "STREAM_ERROR",
    "CONFIG_NOT_FOUND",
    "GIT_NOT_FOUND",
    "NOT_GIT_REPO",
    "COMMAND_FAILED",
    "INVALID_PATH",
  ])("accepts valid error code: %s", (code) => {
    const result = ErrorCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it.each(["UNKNOWN_ERROR", "INVALID_CODE", "", "invalid"])(
    "rejects invalid error code: %s",
    (code) => {
      const result = ErrorCodeSchema.safeParse(code);
      expect(result.success).toBe(false);
    }
  );
});

describe("SHARED_ERROR_CODES", () => {
  it("includes expected shared codes", () => {
    expect(SHARED_ERROR_CODES).toEqual([
      "INTERNAL_ERROR",
      "API_KEY_MISSING",
      "RATE_LIMITED",
    ]);
  });
});

describe("UuidSchema", () => {
  it("accepts valid UUIDs", () => {
    expect(UuidSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(UuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440001").success).toBe(true);
    expect(UuidSchema.safeParse("123e4567-e89b-12d3-a456-426614174000").success).toBe(true);
  });

  it.each([
    ["invalid format", "not-a-uuid"],
    ["missing hyphens", "550e8400e29b41d4a716446655440000"],
    ["too short", "550e8400-e29b-41d4-a716"],
    ["empty string", ""],
    ["random string", "abc-def-ghi-jkl"],
  ])("rejects %s", (_, uuid) => {
    const result = UuidSchema.safeParse(uuid);
    expect(result.success).toBe(false);
  });
});

describe("createDomainErrorCodes", () => {
  it("merges shared codes with domain-specific codes", () => {
    const specificCodes = ["CUSTOM_ERROR", "ANOTHER_ERROR"] as const;
    const result = createDomainErrorCodes(specificCodes);

    expect(result).toEqual([
      "INTERNAL_ERROR",
      "API_KEY_MISSING",
      "RATE_LIMITED",
      "CUSTOM_ERROR",
      "ANOTHER_ERROR",
    ]);
  });

  it("preserves order with shared codes first", () => {
    const specificCodes = ["Z_ERROR", "A_ERROR"] as const;
    const result = createDomainErrorCodes(specificCodes);

    expect(result[0]).toBe("INTERNAL_ERROR");
    expect(result[1]).toBe("API_KEY_MISSING");
    expect(result[2]).toBe("RATE_LIMITED");
    expect(result[3]).toBe("Z_ERROR");
    expect(result[4]).toBe("A_ERROR");
  });

  it("handles empty specific codes", () => {
    const result = createDomainErrorCodes([]);

    expect(result).toEqual(SHARED_ERROR_CODES);
  });
});

describe("createDomainErrorSchema", () => {
  it("creates schema accepting both shared and specific codes", () => {
    const specificCodes = ["CUSTOM_ERROR"] as const;
    const schema = createDomainErrorSchema(specificCodes);

    expect(schema.safeParse({ message: "Error", code: "INTERNAL_ERROR" }).success).toBe(true);
    expect(schema.safeParse({ message: "Error", code: "CUSTOM_ERROR" }).success).toBe(true);
  });

  it("creates schema without details by default", () => {
    const schema = createDomainErrorSchema(["CUSTOM_ERROR"]);
    const result = schema.safeParse({
      message: "Error",
      code: "CUSTOM_ERROR",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect("details" in result.data).toBe(false);
    }
  });

  it("creates schema with optional details when requested", () => {
    const schema = createDomainErrorSchema(["CUSTOM_ERROR"], {
      includeDetails: true,
    });

    const withDetails = schema.safeParse({
      message: "Error",
      code: "CUSTOM_ERROR",
      details: "Additional context",
    });
    expect(withDetails.success).toBe(true);

    const withoutDetails = schema.safeParse({
      message: "Error",
      code: "CUSTOM_ERROR",
    });
    expect(withoutDetails.success).toBe(true);
  });

  it("rejects invalid error codes", () => {
    const schema = createDomainErrorSchema(["CUSTOM_ERROR"]);
    const result = schema.safeParse({
      message: "Error",
      code: "INVALID_CODE",
    });

    expect(result.success).toBe(false);
  });

  it("requires message field", () => {
    const schema = createDomainErrorSchema(["CUSTOM_ERROR"]);
    const result = schema.safeParse({
      code: "CUSTOM_ERROR",
    });

    expect(result.success).toBe(false);
  });

  it("requires code field", () => {
    const schema = createDomainErrorSchema(["CUSTOM_ERROR"]);
    const result = schema.safeParse({
      message: "Error message",
    });

    expect(result.success).toBe(false);
  });
});

describe("ChunkEventSchema", () => {
  it("accepts valid chunk event", () => {
    const result = ChunkEventSchema.safeParse({
      type: "chunk",
      content: "Processing data...",
    });
    expect(result.success).toBe(true);
  });

  it("accepts chunk event with empty content", () => {
    const result = ChunkEventSchema.safeParse({
      type: "chunk",
      content: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects chunk event without content", () => {
    const result = ChunkEventSchema.safeParse({
      type: "chunk",
    });
    expect(result.success).toBe(false);
  });

  it("rejects chunk event with wrong type", () => {
    const result = ChunkEventSchema.safeParse({
      type: "error",
      content: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("ErrorEventSchema", () => {
  it("creates schema for error events with custom error type", () => {
    const customErrorSchema = z.object({
      message: z.string(),
      code: z.enum(["CUSTOM_ERROR"]),
    });
    const schema = ErrorEventSchema(customErrorSchema);

    const result = schema.safeParse({
      type: "error",
      error: {
        message: "Something went wrong",
        code: "CUSTOM_ERROR",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects error event with invalid error", () => {
    const customErrorSchema = z.object({
      message: z.string(),
      code: z.enum(["CUSTOM_ERROR"]),
    });
    const schema = ErrorEventSchema(customErrorSchema);

    const result = schema.safeParse({
      type: "error",
      error: {
        code: "CUSTOM_ERROR",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects error event without error field", () => {
    const customErrorSchema = z.object({
      message: z.string(),
      code: z.enum(["CUSTOM_ERROR"]),
    });
    const schema = ErrorEventSchema(customErrorSchema);

    const result = schema.safeParse({
      type: "error",
    });
    expect(result.success).toBe(false);
  });
});

describe("createStreamEventSchema", () => {
  const customErrorSchema = z.object({
    message: z.string(),
    code: z.enum(["STREAM_ERROR"]),
  });

  it("creates schema accepting chunk events", () => {
    const schema = createStreamEventSchema(
      { result: z.string() },
      customErrorSchema
    );

    const result = schema.safeParse({
      type: "chunk",
      content: "Processing...",
    });
    expect(result.success).toBe(true);
  });

  it("creates schema accepting complete events with custom shape", () => {
    const schema = createStreamEventSchema(
      { result: z.string(), count: z.number() },
      customErrorSchema
    );

    const result = schema.safeParse({
      type: "complete",
      result: "Done",
      count: 42,
    });
    expect(result.success).toBe(true);
  });

  it("creates schema accepting error events", () => {
    const schema = createStreamEventSchema(
      { result: z.string() },
      customErrorSchema
    );

    const result = schema.safeParse({
      type: "error",
      error: {
        message: "Stream failed",
        code: "STREAM_ERROR",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects events with invalid type", () => {
    const schema = createStreamEventSchema(
      { result: z.string() },
      customErrorSchema
    );

    const result = schema.safeParse({
      type: "invalid",
      content: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects complete event missing required fields", () => {
    const schema = createStreamEventSchema(
      { result: z.string(), required: z.number() },
      customErrorSchema
    );

    const result = schema.safeParse({
      type: "complete",
      result: "Done",
    });
    expect(result.success).toBe(false);
  });

  it("validates complete event fields according to shape", () => {
    const schema = createStreamEventSchema(
      { result: z.string(), count: z.number().positive() },
      customErrorSchema
    );

    const valid = schema.safeParse({
      type: "complete",
      result: "Done",
      count: 5,
    });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({
      type: "complete",
      result: "Done",
      count: -1,
    });
    expect(invalid.success).toBe(false);
  });
});
