import { describe, it, expect, vi } from "vitest";
import { zodErrorHandler, errorResponse } from "./response.js";

const mockJson = vi.fn().mockImplementation((body, status) => ({
  body,
  status,
}));

const mockCtx = { json: mockJson } as any;

describe("errorResponse", () => {
  it("should return JSON response with error shape", () => {
    const result = errorResponse(mockCtx, "not found", "NOT_FOUND", 404);

    expect(mockJson).toHaveBeenCalledWith(
      { error: { message: "not found", code: "NOT_FOUND" } },
      404,
    );
  });
});

describe("zodErrorHandler", () => {
  it("should return undefined for successful result", () => {
    const result = zodErrorHandler(
      { success: true, data: { name: "test" } },
      mockCtx,
    );
    expect(result).toBeUndefined();
  });

  it("should return 400 response for failed validation", () => {
    const zodError = {
      issues: [
        { message: "Required", path: ["name"], code: "invalid_type" },
      ],
    };

    zodErrorHandler(
      { success: false, error: zodError } as any,
      mockCtx,
    );

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "Required",
          code: "VALIDATION_ERROR",
        }),
      }),
      400,
    );
  });

  it("should use fallback message when no issues", () => {
    const zodError = { issues: [] };

    zodErrorHandler(
      { success: false, error: zodError } as any,
      mockCtx,
    );

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "Invalid body",
        }),
      }),
      400,
    );
  });
});
