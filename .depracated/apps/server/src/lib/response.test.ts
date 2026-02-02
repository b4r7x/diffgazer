import { describe, it, expect, vi, type Mock } from "vitest";
import type { Context } from "hono";
import { handleStoreError, zodErrorHandler, errorResponse } from "./response.js";
import type { StoreError } from "../storage/index.js";
import { ErrorCode } from "@repo/schemas/errors";

type JsonMock = Mock<(data: unknown, status?: number) => Response>;

type MockedContext = Context & {
  json: JsonMock;
};

function createMockContext(): MockedContext {
  return {
    json: vi.fn((data: unknown, status?: number) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  } as MockedContext;
}

describe("handleStoreError", () => {
  it("returns 404 for NOT_FOUND error", () => {
    const ctx = createMockContext();
    const error: StoreError = {
      message: "Session not found",
      code: "NOT_FOUND",
    };

    handleStoreError(ctx, error);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Session not found",
          code: "NOT_FOUND",
        },
      },
      404
    );
  });

  it("returns 400 for VALIDATION_ERROR", () => {
    const ctx = createMockContext();
    const error: StoreError = {
      message: "Invalid input data",
      code: "VALIDATION_ERROR",
    };

    handleStoreError(ctx, error);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Invalid input data",
          code: "VALIDATION_ERROR",
        },
      },
      400
    );
  });

  it("returns 403 for PERMISSION_ERROR", () => {
    const ctx = createMockContext();
    const error: StoreError = {
      message: "Access denied",
      code: "PERMISSION_ERROR",
    };

    handleStoreError(ctx, error);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Access denied",
          code: "PERMISSION_ERROR",
        },
      },
      403
    );
  });

  it("returns 500 for WRITE_ERROR", () => {
    const ctx = createMockContext();
    const error: StoreError = {
      message: "Failed to write file",
      code: "WRITE_ERROR",
    };

    handleStoreError(ctx, error);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Failed to write file",
          code: "WRITE_ERROR",
        },
      },
      500
    );
  });
});

describe("zodErrorHandler", () => {
  it("returns undefined when validation succeeds", () => {
    const ctx = createMockContext();
    const result = {
      success: true as const,
      data: { name: "Alice", age: 30 },
    };

    const response = zodErrorHandler(result, ctx);

    expect(response).toBeUndefined();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it("returns error response when validation fails with message", () => {
    const ctx = createMockContext();
    const result = {
      success: false as const,
      error: {
        errors: [{ message: "Name is required" }],
      },
    };

    const response = zodErrorHandler(result, ctx);

    expect(response).toBeInstanceOf(Response);
    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Name is required",
          code: ErrorCode.VALIDATION_ERROR,
        },
      },
      400
    );
  });

  it("returns generic error when validation fails without message", () => {
    const ctx = createMockContext();
    const result = {
      success: false as const,
      error: {
        errors: [{}],
      },
    };

    const response = zodErrorHandler(result, ctx);

    expect(response).toBeInstanceOf(Response);
    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Invalid body",
          code: ErrorCode.VALIDATION_ERROR,
        },
      },
      400
    );
  });

  it("handles empty errors array", () => {
    const ctx = createMockContext();
    const result = {
      success: false as const,
      error: {
        errors: [],
      },
    };

    const response = zodErrorHandler(result, ctx);

    expect(response).toBeInstanceOf(Response);
    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Invalid body",
          code: ErrorCode.VALIDATION_ERROR,
        },
      },
      400
    );
  });
});

describe("errorResponse", () => {
  it("returns error response with correct format", () => {
    const ctx = createMockContext();

    errorResponse(ctx, "Invalid request", ErrorCode.VALIDATION_ERROR, 400);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Invalid request",
          code: ErrorCode.VALIDATION_ERROR,
        },
      },
      400
    );
  });

  it("handles custom error codes", () => {
    const ctx = createMockContext();

    errorResponse(ctx, "Custom error", "CUSTOM_ERROR", 422);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "Custom error",
          code: "CUSTOM_ERROR",
        },
      },
      422
    );
  });

  it("handles empty error message", () => {
    const ctx = createMockContext();

    errorResponse(ctx, "", ErrorCode.INTERNAL_ERROR, 500);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          message: "",
          code: ErrorCode.INTERNAL_ERROR,
        },
      },
      500
    );
  });
});
