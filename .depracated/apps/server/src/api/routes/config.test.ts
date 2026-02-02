import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { config as configRouter } from "./config.js";
import * as configStorage from "../../storage/index.js";
import * as secrets from "../../secrets/index.js";
import { ok, err, createError } from "@repo/core";

vi.mock("../../storage/index.js", async () => {
  const actual = await vi.importActual("../../storage/index.js");
  return {
    ...actual,
    configStore: {
      read: vi.fn(),
    },
  };
});

vi.mock("../../secrets/index.js", () => ({
  getApiKey: vi.fn(),
}));

describe("GET /config/check", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/", configRouter);
    vi.clearAllMocks();
  });

  it("returns configured: false when config file does not exist", async () => {
    vi.mocked(configStorage.configStore.read).mockResolvedValue(
      err(createError("NOT_FOUND", "config not found"))
    );

    const res = await app.request("/check");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ configured: false });
  });

  it("returns configured: false when config exists but API key does not", async () => {
    vi.mocked(configStorage.configStore.read).mockResolvedValue(
      ok({
        provider: "openai",
        model: "gpt-4",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      })
    );
    vi.mocked(secrets.getApiKey).mockResolvedValue(
      err(createError("SECRET_NOT_FOUND", "API key not found"))
    );

    const res = await app.request("/check");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ configured: false });
  });

  it("returns configured: false when config exists but API key is empty", async () => {
    vi.mocked(configStorage.configStore.read).mockResolvedValue(
      ok({
        provider: "openai",
        model: "gpt-4",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      })
    );
    vi.mocked(secrets.getApiKey).mockResolvedValue(ok(""));

    const res = await app.request("/check");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ configured: false });
  });

  it("returns configured: true when config and API key both exist", async () => {
    vi.mocked(configStorage.configStore.read).mockResolvedValue(
      ok({
        provider: "openai",
        model: "gpt-4",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      })
    );
    vi.mocked(secrets.getApiKey).mockResolvedValue(ok("sk-test-key"));

    const res = await app.request("/check");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      configured: true,
      config: {
        provider: "openai",
        model: "gpt-4",
      },
    });
  });
});
