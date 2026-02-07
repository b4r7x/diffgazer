import { describe, it, expect, vi } from "vitest";
import { errorResponse, zodErrorHandler } from "./response.js";
import { ErrorCode } from "@stargazer/schemas/errors";

function createMockContext() {
  const jsonFn = vi.fn((body: unknown, status?: number) => ({
    body,
    status: status ?? 200,
  }));
  return { json: jsonFn } as any;
}

describe("errorResponse", () => {
  it("should return known status code when valid", () => {
    const ctx = createMockContext();

    errorResponse(ctx, "Not found", ErrorCode.NOT_FOUND, 404);

    expect(ctx.json).toHaveBeenCalledWith(
      { error: { message: "Not found", code: ErrorCode.NOT_FOUND } },
      404,
    );
  });

  it("should fall back to 500 for unknown status code", () => {
    const ctx = createMockContext();

    errorResponse(ctx, "Weird error", "CUSTOM_CODE", 999);

    expect(ctx.json).toHaveBeenCalledWith(
      { error: { message: "Weird error", code: "CUSTOM_CODE" } },
      500,
    );
  });

  it("should include error message in response body", () => {
    const ctx = createMockContext();

    errorResponse(ctx, "Something went wrong", ErrorCode.INTERNAL_ERROR, 500);

    const [body] = ctx.json.mock.calls[0]!;
    expect(body.error.message).toBe("Something went wrong");
  });
});

describe("zodErrorHandler", () => {
  it("should extract first issue message from Zod error", () => {
    const ctx = createMockContext();
    const zodResult = {
      success: false as const,
      error: {
        issues: [
          { message: "Expected string, received number", path: ["name"] },
          { message: "Required", path: ["age"] },
        ],
      },
    };

    zodErrorHandler(zodResult, ctx);

    const [body, status] = ctx.json.mock.calls[0]!;
    expect(body.error.message).toBe("Expected string, received number");
    expect(status).toBe(400);
  });

  it("should return 400 status with VALIDATION_ERROR code", () => {
    const ctx = createMockContext();
    const zodResult = {
      success: false as const,
      error: {
        issues: [{ message: "Invalid", path: [] }],
      },
    };

    zodErrorHandler(zodResult, ctx);

    const [body, status] = ctx.json.mock.calls[0]!;
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(status).toBe(400);
  });

  it("should return undefined for successful result", () => {
    const ctx = createMockContext();
    const zodResult = { success: true as const, data: { name: "test" } };

    const response = zodErrorHandler(zodResult, ctx);

    expect(response).toBeUndefined();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it("should fall back to 'Invalid body' when no issues exist", () => {
    const ctx = createMockContext();
    const zodResult = {
      success: false as const,
      error: { issues: [] },
    };

    zodErrorHandler(zodResult, ctx);

    const [body] = ctx.json.mock.calls[0]!;
    expect(body.error.message).toBe("Invalid body");
  });
});
