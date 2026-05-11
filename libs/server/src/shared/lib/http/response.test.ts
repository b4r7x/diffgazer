import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import type { Handler } from "hono";
import { z } from "zod";
import { errorResponse, zodErrorHandler } from "./response.js";
import { ErrorCode } from "@diffgazer/core/schemas/errors";

type ErrorBody = {
  error: {
    message: string;
    code: string;
  };
};

async function requestError(
  handler: Handler,
): Promise<{ response: Response; body: ErrorBody }> {
  const app = new Hono();
  app.get("/", handler);

  const response = await app.request("/");
  return {
    response,
    body: await response.json() as ErrorBody,
  };
}

describe("errorResponse", () => {
  it("returns a JSON error response with the requested status", async () => {
    const { response, body } = await requestError((ctx) =>
      errorResponse(ctx, "Not found", ErrorCode.NOT_FOUND, 404),
    );

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: { message: "Not found", code: ErrorCode.NOT_FOUND },
    });
  });

  it("falls back to 500 for unsupported status codes", async () => {
    const { response, body } = await requestError((ctx) =>
      errorResponse(ctx, "Weird error", "CUSTOM_CODE", 999),
    );

    expect(response.status).toBe(500);
    expect(body.error).toEqual({ message: "Weird error", code: "CUSTOM_CODE" });
  });
});

describe("zodErrorHandler", () => {
  it("returns the first Zod issue as a validation error response", async () => {
    const result = z.object({ name: z.string(), age: z.number() }).safeParse({
      name: 123,
      age: "nope",
    });
    const { response, body } = await requestError((ctx) => zodErrorHandler(result, ctx)!);

    expect(response.status).toBe(400);
    expect(body.error).toEqual({
      message: "Invalid input: expected string, received number",
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it("returns undefined for successful validation", async () => {
    const app = new Hono();
    const result = { success: true as const, data: { name: "test" } };
    app.get("/", (ctx) => zodErrorHandler(result, ctx) ?? ctx.json({ ok: true }));

    const response = await app.request("/");
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("uses a fallback message when the Zod error has no issues", async () => {
    const result = {
      success: false as const,
      error: { issues: [] } as unknown as z.core.$ZodError,
    };
    const { body } = await requestError((ctx) => zodErrorHandler(result, ctx)!);

    expect(body.error.message).toBe("Invalid body");
  });
});
