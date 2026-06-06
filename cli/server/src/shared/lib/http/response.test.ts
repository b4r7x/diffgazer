import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Handler } from "hono";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { requireValue } from "../../../testing/assertions.js";
import { errorResponse, zodErrorHandler } from "./response.js";

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

  it("emits each declared error status, including 413 payload-too-large", async () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 500, 503] as const) {
      const { response } = await requestError((ctx) =>
        errorResponse(ctx, "err", "CODE", status),
      );
      expect(response.status).toBe(status);
    }
  });
});

describe("zodErrorHandler", () => {
  it("returns the first Zod issue as a validation error response", async () => {
    const result = z.object({ name: z.string(), age: z.number() }).safeParse({
      name: 123,
      age: "nope",
    });
    const { response, body } = await requestError((ctx) =>
      requireValue(zodErrorHandler(result, ctx), "zod error response")
    );

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
    const { body } = await requestError((ctx) =>
      requireValue(zodErrorHandler(result, ctx), "zod error response")
    );

    expect(body.error.message).toBe("Invalid body");
  });
});
